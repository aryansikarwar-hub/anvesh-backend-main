import { Types } from 'mongoose';
import { withTransaction } from '../../lib/database';
import { type Env } from '../../lib/config';
import {
  ERROR_CODES,
  PAYMENT_TRANSITIONS,
  type CheckoutIntent,
  type Payment,
  type PaymentStatus,
} from '../../lib/types';
import { type VerifyPaymentInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { getLogger } from '../../common/logger';
import { type RazorpayClient } from '../../infra/payments/razorpay.client';
import { type BookingRepository } from '../bookings/booking.repository';
import { type ExperienceRepository } from '../experiences/experience.repository';
import { type GuideRepository } from '../guides/guide.repository';
import { type AuthRepository } from '../auth/auth.repository';
import { type QueuePublisher } from '../../infra/queue';
import { type PaymentRepository } from './payment.repository';
import { toPayment } from './payment.mapper';

/**
 * Payment orchestration.
 *
 * A booking is only ever CONFIRMED after a signature this server computed
 * itself matches the one the client presented. There is no code path in which
 * the client's assertion of success is enough.
 */
export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly bookings: BookingRepository,
    private readonly experiences: ExperienceRepository,
    private readonly guides: GuideRepository,
    private readonly users: AuthRepository,
    private readonly razorpay: RazorpayClient,
    private readonly queue: QueuePublisher,
    private readonly env: Env,
  ) {}

  async createOrder(userId: string, bookingId: string): Promise<CheckoutIntent> {
    if (!this.razorpay.configured) {
      throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED, {
        message: 'Payments are not configured on this deployment.',
      });
    }

    const booking = await this.bookings.findOwnedByUser(userId, bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new AppError(ERROR_CODES.BOOKING_INVALID_STATE, {
        message: 'This booking is not awaiting payment.',
      });
    }
    if (booking.expiresAt && booking.expiresAt.getTime() < Date.now()) {
      throw new AppError(ERROR_CODES.BOOKING_EXPIRED);
    }

    const existing = await this.repo.findByBooking(booking._id);
    if (existing && existing.status === 'CREATED') {
      return this.toIntent(booking, existing.providerOrderId, String(existing._id), userId);
    }

    const order = await this.razorpay.createOrder({
      amountMinor: booking.totalMinor,
      currency: booking.currency,
      receipt: booking.code,
      notes: { bookingId: String(booking._id), code: booking.code },
    });

    const payment = await this.repo.create({
      bookingId: booking._id,
      userId: new Types.ObjectId(userId),
      provider: 'RAZORPAY',
      providerOrderId: order.id,
      amountMinor: booking.totalMinor,
      currency: booking.currency,
      status: 'CREATED',
    });

    await this.bookings.updateStatus(booking._id, booking.status, 'SYSTEM', 'Payment order created', {
      paymentId: payment._id,
    });

    return this.toIntent(booking, order.id, String(payment._id), userId);
  }

  /** Verifies the checkout callback and confirms the booking, atomically. */
  async verify(userId: string, input: VerifyPaymentInput): Promise<Payment> {
    const booking = await this.bookings.findOwnedByUser(userId, input.bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);

    const payment = await this.repo.findByOrderId(input.razorpayOrderId);
    if (!payment || String(payment.bookingId) !== String(booking._id)) {
      throw new AppError(ERROR_CODES.PAYMENT_NOT_FOUND);
    }
    if (payment.status === 'CAPTURED') return toPayment(payment);

    const signatureOk = this.razorpay.verifyCheckoutSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );
    if (!signatureOk) {
      await this.repo.update(payment._id, {
        $set: { status: 'FAILED', failureReason: 'Signature mismatch' },
      });
      throw new AppError(ERROR_CODES.PAYMENT_SIGNATURE_INVALID);
    }

    // Trust the provider's own record of the amount, not the client's.
    const providerPayment = await this.razorpay.fetchPayment(input.razorpayPaymentId);
    if (providerPayment.amount !== booking.totalMinor) {
      throw new AppError(ERROR_CODES.PAYMENT_AMOUNT_MISMATCH, {
        details: { expected: booking.totalMinor, received: providerPayment.amount },
      });
    }

    return withTransaction(async (session) => {
      const updated = await this.repo.update(
        payment._id,
        {
          $set: {
            providerPaymentId: input.razorpayPaymentId,
            providerSignature: input.razorpaySignature,
            status: 'CAPTURED',
            capturedMinor: booking.totalMinor,
          },
        },
        session,
      );
      await this.bookings.updateStatus(
        booking._id,
        'CONFIRMED',
        'SYSTEM',
        'Payment captured',
        { expiresAt: null },
        session,
      );
      await this.guides.incrementStats(booking.guideId, {
        'stats.bookingCount': 1,
        'stats.lifetimeGrossMinor': booking.subtotalMinor,
        'stats.lifetimeNetMinor': booking.guidePayoutMinor,
      });
      await this.experiences.incrementBookings(booking.experienceId, 1);

      // Side effects are queued, so a Redis outage cannot fail a paid booking.
      await this.queue.bookingEmail(String(booking._id), 'CONFIRMED');
      await this.queue.notify({
        userId: String(booking.userId),
        type: 'BOOKING_CONFIRMED',
        title: `Booking confirmed: ${booking.experienceTitle}`,
        body: `Reference ${booking.code}.`,
        href: `/bookings/${String(booking._id)}`,
      });
      await this.queue.trackEvent({
        type: 'BOOKING_CONFIRMED',
        userId: String(booking.userId),
        experienceId: String(booking.experienceId),
      });

      return toPayment(updated as never);
    });
  }

  async getByBooking(userId: string, bookingId: string): Promise<Payment> {
    const booking = await this.bookings.findOwnedByUser(userId, bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);
    const payment = await this.repo.findByBooking(booking._id);
    if (!payment) throw new AppError(ERROR_CODES.PAYMENT_NOT_FOUND);
    return toPayment(payment);
  }

  private async toIntent(
    booking: { _id: Types.ObjectId; totalMinor: number; currency: string; experienceTitle: string; code: string; expiresAt: Date | null },
    orderId: string,
    paymentId: string,
    userId: string,
  ): Promise<CheckoutIntent> {
    const user = await this.users.findById(userId);
    return {
      bookingId: String(booking._id),
      paymentId,
      providerOrderId: orderId,
      keyId: this.razorpay.publishableKeyId,
      amountMinor: booking.totalMinor,
      currency: booking.currency,
      name: 'Anvesh',
      description: booking.experienceTitle,
      prefill: {
        name: user?.profile.displayName ?? '',
        email: user?.email ?? '',
      },
      expiresAt: (
        booking.expiresAt ?? new Date(Date.now() + this.env.BOOKING_HOLD_MINUTES * 60_000)
      ).toISOString(),
    };
  }

  static assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
    if (!PAYMENT_TRANSITIONS[from].includes(to)) {
      throw new AppError(ERROR_CODES.PAYMENT_INVALID_STATE, {
        details: { from, to, allowed: PAYMENT_TRANSITIONS[from] },
      });
    }
  }

  logDroppedWebhook(eventId: string, reason: string): void {
    getLogger().warn({ eventId, reason }, 'webhook ignored');
  }
}

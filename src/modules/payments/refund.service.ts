import { withTransaction } from '../../lib/database';
import { ERROR_CODES, type Payment } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { type RazorpayClient } from '../../infra/payments/razorpay.client';
import { type BookingRepository } from '../bookings/booking.repository';
import { type GuideRepository } from '../guides/guide.repository';
import { type PaymentRepository } from './payment.repository';
import { toPayment } from './payment.mapper';

export interface RefundActor {
  userId: string;
  role: 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR' | 'TOURIST_GUIDE';
}

/**
 * Refunds. The amount is always recomputed server-side and can never exceed
 * what was actually captured minus what has already been refunded.
 */
export class RefundService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly bookings: BookingRepository,
    private readonly guides: GuideRepository,
    private readonly razorpay: RazorpayClient,
  ) {}

  async refund(
    bookingId: string,
    amountMinor: number | undefined,
    reason: string,
    actor: RefundActor,
  ): Promise<Payment> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);

    if (actor.role === 'TOURIST_GUIDE') {
      const guide = await this.guides.findOwnedBy(actor.userId);
      if (!guide || String(guide._id) !== String(booking.guideId)) {
        throw AppError.forbidden(ERROR_CODES.NOT_RESOURCE_OWNER);
      }
    }

    const payment = await this.payments.findByBooking(booking._id);
    if (!payment) throw new AppError(ERROR_CODES.PAYMENT_NOT_FOUND);
    if (payment.status !== 'CAPTURED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new AppError(ERROR_CODES.REFUND_NOT_ALLOWED, {
        message: 'Only a captured payment can be refunded.',
      });
    }

    const refundable = payment.capturedMinor - payment.refundedMinor;
    const requested = amountMinor ?? refundable;
    if (!Number.isInteger(requested) || requested <= 0 || requested > refundable) {
      throw new AppError(ERROR_CODES.REFUND_AMOUNT_INVALID, {
        details: { refundableMinor: refundable },
      });
    }
    if (!payment.providerPaymentId) throw new AppError(ERROR_CODES.PAYMENT_INVALID_STATE);

    const providerRefund = await this.razorpay.createRefund(payment.providerPaymentId, requested, {
      bookingId: String(booking._id),
      reason: reason.slice(0, 100),
    });

    const refundedTotal = payment.refundedMinor + requested;
    const fullyRefunded = refundedTotal >= payment.capturedMinor;

    return withTransaction(async (session) => {
      const updated = await this.payments.update(
        payment._id,
        {
          $set: {
            refundedMinor: refundedTotal,
            status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
          $push: {
            refunds: {
              providerRefundId: providerRefund.id,
              amountMinor: requested,
              status: providerRefund.status === 'processed' ? 'PROCESSED' : 'PENDING',
              reason,
              at: new Date(),
            },
          },
        },
        session,
      );

      await this.bookings.updateStatus(
        booking._id,
        fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        actor.role === 'TOURIST_GUIDE' ? 'GUIDE' : 'ADMIN',
        reason,
        {},
        session,
      );

      return toPayment(updated as never);
    });
  }
}

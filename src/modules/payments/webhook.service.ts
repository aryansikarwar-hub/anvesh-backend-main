import { withTransaction } from '../../lib/database';
import { ERROR_CODES } from '../../lib/types';
import { razorpayWebhookSchema, type RazorpayWebhook } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { getLogger } from '../../common/logger';
import { type RazorpayClient } from '../../infra/payments/razorpay.client';
import { type BookingRepository } from '../bookings/booking.repository';
import { type PaymentRepository } from './payment.repository';

export interface WebhookResult {
  handled: boolean;
  event: string;
  reason?: string;
}

/**
 * Razorpay webhook handling.
 *
 * The signature is verified over the exact raw bytes, the event id is recorded
 * once so redelivery is a no-op, and the webhook can confirm a booking that the
 * browser never came back to confirm.
 */
export class WebhookService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly bookings: BookingRepository,
    private readonly razorpay: RazorpayClient,
  ) {}

  async handle(rawBody: Buffer | undefined, signature: string | undefined, eventId: string) {
    if (!rawBody || !signature) throw new AppError(ERROR_CODES.WEBHOOK_SIGNATURE_INVALID);
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new AppError(ERROR_CODES.WEBHOOK_SIGNATURE_INVALID);
    }

    const parsed = razorpayWebhookSchema.safeParse(JSON.parse(rawBody.toString('utf8')));
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, { message: 'Unrecognised webhook payload.' });
    }

    const event = parsed.data;
    switch (event.event) {
      case 'payment.captured':
        return this.onCaptured(event, eventId);
      case 'payment.failed':
        return this.onFailed(event, eventId);
      case 'refund.processed':
        return this.onRefundProcessed(event, eventId);
      default:
        return { handled: false, event: event.event, reason: 'event not handled' };
    }
  }

  private async onCaptured(event: RazorpayWebhook, eventId: string): Promise<WebhookResult> {
    const entity = event.payload.payment?.entity;
    if (!entity?.order_id) return { handled: false, event: event.event, reason: 'no order id' };

    const payment = await this.payments.findByOrderId(entity.order_id);
    if (!payment) return { handled: false, event: event.event, reason: 'unknown order' };

    const recorded = await this.payments.recordWebhookEvent(payment._id, eventId, event.event);
    if (!recorded) return { handled: true, event: event.event, reason: 'duplicate delivery' };

    if (payment.status === 'CAPTURED') return { handled: true, event: event.event };

    const booking = await this.bookings.findById(String(payment.bookingId));
    if (!booking) return { handled: false, event: event.event, reason: 'unknown booking' };
    if (entity.amount !== booking.totalMinor) {
      getLogger().error(
        { bookingId: String(booking._id) },
        'webhook amount does not match the booking total',
      );
      return { handled: false, event: event.event, reason: 'amount mismatch' };
    }

    await withTransaction(async (session) => {
      await this.payments.update(
        payment._id,
        {
          $set: {
            providerPaymentId: entity.id,
            status: 'CAPTURED',
            capturedMinor: entity.amount,
          },
        },
        session,
      );
      if (booking.status === 'PENDING_PAYMENT') {
        await this.bookings.updateStatus(
          booking._id,
          'CONFIRMED',
          'SYSTEM',
          'Payment captured (webhook)',
          { expiresAt: null },
          session,
        );
      }
    });

    return { handled: true, event: event.event };
  }

  private async onFailed(event: RazorpayWebhook, eventId: string): Promise<WebhookResult> {
    const entity = event.payload.payment?.entity;
    if (!entity?.order_id) return { handled: false, event: event.event, reason: 'no order id' };
    const payment = await this.payments.findByOrderId(entity.order_id);
    if (!payment) return { handled: false, event: event.event, reason: 'unknown order' };

    const recorded = await this.payments.recordWebhookEvent(payment._id, eventId, event.event);
    if (!recorded) return { handled: true, event: event.event, reason: 'duplicate delivery' };

    await this.payments.update(payment._id, {
      $set: {
        status: 'FAILED',
        providerPaymentId: entity.id,
        failureReason: entity.error_description ?? 'Payment failed at the provider',
      },
    });
    return { handled: true, event: event.event };
  }

  private async onRefundProcessed(event: RazorpayWebhook, eventId: string): Promise<WebhookResult> {
    const entity = event.payload.refund?.entity;
    if (!entity) return { handled: false, event: event.event, reason: 'no refund entity' };
    const payment = await this.payments.findByProviderPaymentId(entity.payment_id);
    if (!payment) return { handled: false, event: event.event, reason: 'unknown payment' };

    const recorded = await this.payments.recordWebhookEvent(payment._id, eventId, event.event);
    if (!recorded) return { handled: true, event: event.event, reason: 'duplicate delivery' };

    await this.payments.markRefundProcessed(payment._id, entity.id);
    return { handled: true, event: event.event };
  }
}

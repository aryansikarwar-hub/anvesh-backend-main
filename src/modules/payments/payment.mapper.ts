import { type Payment } from '../../lib/types';
import { type PaymentDocument } from '../../lib/database';

/** Signatures and raw provider payloads are never mapped out to a client. */
export function toPayment(doc: PaymentDocument): Payment {
  return {
    id: String(doc._id),
    bookingId: String(doc.bookingId),
    provider: doc.provider,
    providerOrderId: doc.providerOrderId,
    providerPaymentId: doc.providerPaymentId,
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    status: doc.status,
    refunds: doc.refunds.map((refund) => ({
      providerRefundId: refund.providerRefundId,
      amountMinor: refund.amountMinor,
      status: refund.status as 'PENDING' | 'PROCESSED' | 'FAILED',
      reason: refund.reason,
      at: new Date(refund.at).toISOString(),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

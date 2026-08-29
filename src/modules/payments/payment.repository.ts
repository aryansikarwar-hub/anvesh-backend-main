import { Types, type ClientSession } from 'mongoose';
import { PaymentModel, type PaymentDocument } from '../../lib/database';

export class PaymentRepository {
  async create(document: Record<string, unknown>): Promise<PaymentDocument> {
    const [created] = await PaymentModel.create([document]);
    return created as PaymentDocument;
  }

  async findByBooking(bookingId: Types.ObjectId) {
    return PaymentModel.findOne({ bookingId }).exec();
  }

  async findByOrderId(orderId: string) {
    return PaymentModel.findOne({ providerOrderId: orderId }).exec();
  }

  async findByProviderPaymentId(paymentId: string) {
    return PaymentModel.findOne({ providerPaymentId: paymentId }).exec();
  }

  async findOwned(userId: string, paymentId: string) {
    if (!Types.ObjectId.isValid(paymentId)) return null;
    return PaymentModel.findOne({
      _id: new Types.ObjectId(paymentId),
      userId: new Types.ObjectId(userId),
    }).exec();
  }

  async update(
    id: Types.ObjectId,
    update: Record<string, unknown>,
    session?: ClientSession,
  ) {
    return PaymentModel.findByIdAndUpdate(id, update, {
      new: true,
      ...(session ? { session } : {}),
    }).exec();
  }

  /**
   * Records a webhook event only if its id has not been seen before. The
   * returned document is null when the event was a duplicate, which is how the
   * handler stays idempotent under Razorpay's at-least-once delivery.
   */
  async recordWebhookEvent(id: Types.ObjectId, eventId: string, type: string) {
    return PaymentModel.findOneAndUpdate(
      { _id: id, 'webhookEvents.eventId': { $ne: eventId } },
      { $push: { webhookEvents: { eventId, type, at: new Date() } } },
      { new: true },
    ).exec();
  }

  /** Marks one refund entry processed, matched by the provider's refund id. */
  async markRefundProcessed(id: Types.ObjectId, providerRefundId: string) {
    return PaymentModel.findOneAndUpdate(
      { _id: id, 'refunds.providerRefundId': providerRefundId },
      { $set: { 'refunds.$.status': 'PROCESSED' } },
      { new: true },
    ).exec();
  }

  async adminList(filter: Record<string, unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      PaymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      PaymentModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

import { MediaAssetModel, OutboxEventModel, withTransaction } from '../../lib/database';
import { AvailabilitySlotModel, BookingModel } from '../../lib/database';
import { cleanupJobSchema } from '../../lib/validation';
import { log } from '../logger';

const BATCH = 100;

/**
 * Housekeeping.
 *
 * EXPIRE_BOOKINGS is the important one: an unpaid booking holds seats, and this
 * is what gives them back. It repeats the same atomic release the API uses, so
 * seats never leak even if a traveller closes the tab mid-checkout.
 */
export function cleanupProcessor() {
  return async (payload: unknown): Promise<{ task: string; affected: number }> => {
    const job = cleanupJobSchema.parse(payload);

    if (job.task === 'EXPIRE_BOOKINGS') {
      const stale = await BookingModel.find({
        status: 'PENDING_PAYMENT',
        expiresAt: { $lt: new Date() },
      })
        .limit(BATCH)
        .exec();

      for (const booking of stale) {
        await withTransaction(async (session) => {
          const slot = await AvailabilitySlotModel.findById(booking.slotId).session(session).exec();
          if (slot) {
            const restored = Math.min(slot.seatsTotal, slot.seatsAvailable + booking.seats);
            await AvailabilitySlotModel.updateOne(
              { _id: slot._id },
              { $set: { seatsAvailable: restored } },
              { session },
            ).exec();
          }
          await BookingModel.updateOne(
            { _id: booking._id },
            {
              $set: { status: 'EXPIRED' },
              $push: {
                timeline: {
                  status: 'EXPIRED',
                  at: new Date(),
                  by: 'SYSTEM',
                  reason: 'Payment was not completed in time',
                },
              },
            },
            { session },
          ).exec();
        });
      }
      log().info({ expired: stale.length }, 'expired unpaid bookings and released seats');
      return { task: job.task, affected: stale.length };
    }

    if (job.task === 'DRAIN_OUTBOX') {
      const pending = await OutboxEventModel.find({ status: 'PENDING' }).limit(BATCH).exec();
      for (const event of pending) {
        event.set('status', 'DISPATCHED');
        event.set('dispatchedAt', new Date());
        await event.save();
      }
      return { task: job.task, affected: pending.length };
    }

    // Presigned uploads that were never finalised.
    const cutoff = new Date(Date.now() - 86_400_000);
    const result = await MediaAssetModel.updateMany(
      { status: 'PENDING', createdAt: { $lt: cutoff } },
      { $set: { status: 'FAILED', deletedAt: new Date() } },
    ).exec();
    return { task: job.task, affected: result.modifiedCount };
  };
}

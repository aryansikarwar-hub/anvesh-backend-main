import { Types } from 'mongoose';
import { AnalyticsEventModel, PlaceDailyStatsModel } from '../../lib/database';
import { analyticsEventJobSchema } from '../../lib/validation';

const TYPE_TO_FIELD: Record<string, string> = {
  PLACE_VIEW: 'views',
  PLACE_SAVE: 'saves',
  BOOKING_CONFIRMED: 'bookings',
};

/** Records one raw event and increments the per-place per-day rollup. */
export function analyticsProcessor() {
  return async (payload: unknown): Promise<void> => {
    const job = analyticsEventJobSchema.parse(payload);
    const occurredAt = new Date(job.occurredAt);

    await AnalyticsEventModel.create([
      {
        type: job.type,
        userId: job.userId ? new Types.ObjectId(job.userId) : null,
        placeId: job.placeId ? new Types.ObjectId(job.placeId) : null,
        experienceId: job.experienceId ? new Types.ObjectId(job.experienceId) : null,
        query: job.query,
        occurredAt,
      },
    ]);

    const field = TYPE_TO_FIELD[job.type];
    if (!field || !job.placeId) return;

    await PlaceDailyStatsModel.updateOne(
      { placeId: new Types.ObjectId(job.placeId), day: occurredAt.toISOString().slice(0, 10) },
      { $inc: { [field]: 1 } },
      { upsert: true },
    ).exec();
  };
}

import { type Types } from 'mongoose';
import { ExperienceModel, GuideProfileModel, PlaceModel } from '../../lib/database';
import { summarySyncJobSchema } from '../../lib/validation';
import { log } from '../logger';

/**
 * Keeps the denormalised `guideSummary` copies in step with the guide profile.
 *
 * Hot read paths must not $lookup, so places and experiences carry a copy of
 * the guide card. When the source changes, this job repairs every copy; it also
 * runs nightly as a consistency sweep, so a missed event is self-healing.
 */
export function summaryProcessor() {
  return async (payload: unknown): Promise<{ places: number; experiences: number }> => {
    const job = summarySyncJobSchema.parse(payload);
    const guide = await GuideProfileModel.findById(job.guideId).lean().exec();
    if (!guide) return { places: 0, experiences: 0 };

    const summary = {
      guideId: guide._id,
      displayName: guide.displayName,
      slug: guide.slug,
      ...(guide.avatarUrl ? { avatarUrl: guide.avatarUrl } : {}),
      verified: guide.verified,
      ratingAvg: guide.ratingAvg,
      ratingCount: guide.ratingCount,
    };

    const [places, experiences] = await Promise.all([
      PlaceModel.updateMany(
        { 'guideSummary.guideId': guide._id },
        { $set: { guideSummary: summary } },
      ).exec(),
      ExperienceModel.updateMany({ guideId: guide._id }, { $set: { guideSummary: summary } }).exec(),
    ]);

    log().info(
      { guideId: job.guideId, places: places.modifiedCount, experiences: experiences.modifiedCount },
      'guide summary synced',
    );
    return { places: places.modifiedCount, experiences: experiences.modifiedCount };
  };
}

/** Nightly sweep over every guide, independent of any event stream. */
export async function sweepAllGuideSummaries(): Promise<number> {
  const guides = await GuideProfileModel.find().select('_id').lean().exec();
  const run = summaryProcessor();
  for (const guide of guides) {
    await run({ guideId: String(guide._id as Types.ObjectId) });
  }
  return guides.length;
}

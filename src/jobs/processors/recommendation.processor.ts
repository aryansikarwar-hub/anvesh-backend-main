import { PlaceModel, RecommendationConfigModel, AnalyticsEventModel } from '../../lib/database';
import { clamp01, freshness, scoreCandidate } from '../../lib/shared';
import { recommendationJobSchema } from '../../lib/validation';
import { log } from '../logger';

const POPULARITY_WINDOW_DAYS = 30;

/**
 * Nightly ranking refresh.
 *
 * Two things happen here, in this order:
 *  1. `popularityScore` is recomputed from REAL interaction counts in the last
 *     30 days, normalised against the busiest place in the window.
 *  2. `discoveryScore` is recomputed with the active weights.
 *
 * Because popularity is a penalty, a place that gets busier this month ranks
 * lower next month. That is the product working as intended, not a bug.
 */
export function recommendationProcessor() {
  return async (payload: unknown): Promise<{ updated: number }> => {
    const job = recommendationJobSchema.parse(payload);
    const config = await RecommendationConfigModel.findOne({ active: true }).lean().exec();
    if (!config) throw new Error('No active recommendation config');

    const since = new Date(Date.now() - POPULARITY_WINDOW_DAYS * 86_400_000);
    const counts = await AnalyticsEventModel.aggregate<{ _id: unknown; interactions: number }>([
      {
        $match: {
          occurredAt: { $gte: since },
          placeId: { $ne: null },
          type: { $in: ['PLACE_VIEW', 'PLACE_SAVE', 'BOOKING_CONFIRMED'] },
        },
      },
      { $group: { _id: '$placeId', interactions: { $sum: 1 } } },
    ]).exec();

    const busiest = counts.reduce((max, row) => Math.max(max, row.interactions), 0);
    const popularity = new Map(
      counts.map((row) => [String(row._id), busiest === 0 ? 0 : row.interactions / busiest]),
    );

    const places = await PlaceModel.find({ status: 'PUBLISHED' }).exec();
    let updated = 0;

    for (const place of places) {
      const measured = popularity.get(String(place._id)) ?? 0;
      // Smooth so a single busy week does not whipsaw the ranking.
      const blended = clamp01(place.signals.popularityScore * 0.6 + measured * 0.4);
      place.set('signals.popularityScore', blended);

      const { score } = scoreCandidate(
        {
          relevance: place.signals.qualityScore,
          preferenceMatch: 0,
          quality: place.signals.qualityScore,
          authenticity: place.signals.authenticityScore,
          localOwnership: place.signals.localOwnership,
          freshness: freshness(place.signals.lastVerifiedAt, config.params.freshnessHalfLifeDays),
          uniqueness: place.signals.uniquenessScore,
          popularity: blended,
          crowd: place.signals.crowdLevel,
        },
        config.weights,
      );
      place.set('discoveryScore', score);
      await place.save();
      updated += 1;
    }

    log().info({ updated, reason: job.reason }, 'discovery scores refreshed');
    return { updated };
  };
}

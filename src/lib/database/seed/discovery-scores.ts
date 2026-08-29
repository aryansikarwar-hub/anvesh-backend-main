import { freshness, scoreCandidate } from '../../shared';
import { PlaceModel, RecommendationConfigModel } from '../models';
import { type SeedContext } from './context';

/**
 * Precomputes `discoveryScore` for every published place using the active
 * ranking configuration, so cold-start feeds do not have to score at query
 * time. The worker runs the same routine nightly.
 */
export async function recomputeDiscoveryScores(ctx: SeedContext): Promise<number> {
  const config = await RecommendationConfigModel.findOne({ active: true }).lean();
  if (!config) throw new Error('No active recommendation config found');

  const places = await PlaceModel.find({ status: 'PUBLISHED' }).lean();
  let updated = 0;

  for (const place of places) {
    const { score } = scoreCandidate(
      {
        // Without a query there is no text relevance; quality stands in.
        relevance: place.signals.qualityScore,
        preferenceMatch: 0,
        quality: place.signals.qualityScore,
        authenticity: place.signals.authenticityScore,
        localOwnership: place.signals.localOwnership,
        freshness: freshness(
          place.signals.lastVerifiedAt,
          config.params.freshnessHalfLifeDays,
          ctx.now,
        ),
        uniqueness: place.signals.uniquenessScore,
        popularity: place.signals.popularityScore,
        crowd: place.signals.crowdLevel,
      },
      config.weights,
    );
    await PlaceModel.updateOne({ _id: place._id }, { $set: { discoveryScore: score } });
    updated += 1;
  }

  ctx.log(`discovery scores recomputed: ${updated}`);
  return updated;
}

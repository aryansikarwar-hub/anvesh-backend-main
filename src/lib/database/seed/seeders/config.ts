import { RecommendationConfigModel } from '../../models';
import { seedId, type SeedContext } from '../context';

/**
 * The default ranking configuration.
 *
 * These are the numbers the product ships with, not constants baked into code:
 * an admin can change every one of them from the Admin portal. The penalties
 * are what make popularity cost a place its position.
 */
export async function seedRecommendationConfig(ctx: SeedContext): Promise<void> {
  await RecommendationConfigModel.updateOne(
    { _id: seedId('recommendation-config:default') },
    {
      $set: {
        name: 'Local-first default',
        active: true,
        version: 1,
        weights: {
          relevance: 1.0,
          preferenceMatch: 0.9,
          quality: 0.8,
          authenticity: 0.75,
          localOwnership: 0.7,
          freshness: 0.3,
          uniqueness: 0.55,
          popularityPenalty: 1.25,
          crowdPenalty: 0.95,
        },
        params: {
          freshnessHalfLifeDays: 180,
          distanceDecayKm: 40,
          maxCandidates: 300,
          minQuality: 0.2,
          hiddenGemPopularityMax: 0.3,
          hiddenGemMinQuality: 0.55,
        },
        deletedAt: null,
      },
    },
    { upsert: true },
  );
  ctx.log('recommendation config: 1 active');
}

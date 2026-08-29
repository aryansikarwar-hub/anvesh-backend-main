import { RecommendationConfigModel, type RecommendationConfigDocument } from '../../lib/database';
import { ERROR_CODES, type RankingParams, type RankingWeights } from '../../lib/types';
import { type RecommendationConfigUpdateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';

const CACHE_TTL_MS = 300_000;

export interface ActiveRankingConfig {
  id: string;
  name: string;
  version: number;
  weights: RankingWeights;
  params: RankingParams;
}

/**
 * Owns the tunable ranking configuration.
 *
 * Nothing else in the codebase is allowed to hard-code a ranking weight; the
 * scorer in src/lib/shared takes them as an argument and this service is where
 * they come from.
 */
export class RecommendationService {
  private memoryCache: { value: ActiveRankingConfig; expiresAt: number } | null = null;

  async getActive(): Promise<ActiveRankingConfig> {
    if (this.memoryCache && this.memoryCache.expiresAt > Date.now()) return this.memoryCache.value;

    const doc = await RecommendationConfigModel.findOne({ active: true }).lean();
    if (!doc) throw new AppError(ERROR_CODES.RECOMMENDATION_CONFIG_NOT_FOUND);

    const value = toActive(doc);
    this.memoryCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async list(): Promise<ActiveRankingConfig[]> {
    const docs = await RecommendationConfigModel.find().sort({ version: -1 }).lean();
    return docs.map(toActive);
  }

  /**
   * Saves a new version and activates it. The Zod schema already refuses a
   * popularity or crowd penalty of zero, and the collection validator refuses
   * it again at the database level.
   */
  async update(
    input: RecommendationConfigUpdateInput,
    actorId: string,
  ): Promise<ActiveRankingConfig> {
    const current = await RecommendationConfigModel.findOne({ active: true });
    if (!current) throw new AppError(ERROR_CODES.RECOMMENDATION_CONFIG_NOT_FOUND);

    if (input.weights) current.set('weights', input.weights);
    if (input.params) current.set('params', input.params);
    if (input.name) current.set('name', input.name);
    current.set('version', current.version + 1);
    current.set('updatedBy', actorId);
    await current.save();

    await this.invalidate();
    return toActive(current.toObject() as unknown as RecommendationConfigDocument);
  }

  async invalidate(): Promise<void> {
    this.memoryCache = null;
  }
}

function toActive(doc: RecommendationConfigDocument): ActiveRankingConfig {
  return {
    id: String(doc._id),
    name: doc.name,
    version: doc.version,
    weights: doc.weights,
    params: doc.params,
  };
}

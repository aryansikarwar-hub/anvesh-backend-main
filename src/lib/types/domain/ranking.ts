export interface RankingWeights {
  relevance: number;
  preferenceMatch: number;
  quality: number;
  authenticity: number;
  localOwnership: number;
  freshness: number;
  uniqueness: number;
  /** Subtracted. Higher weight = popularity hurts more. */
  popularityPenalty: number;
  /** Subtracted. */
  crowdPenalty: number;
}

export interface RankingParams {
  freshnessHalfLifeDays: number;
  distanceDecayKm: number;
  maxCandidates: number;
  minQuality: number;
  hiddenGemPopularityMax: number;
  hiddenGemMinQuality: number;
}

export interface RecommendationConfig {
  id: string;
  name: string;
  active: boolean;
  version: number;
  weights: RankingWeights;
  params: RankingParams;
  updatedAt: string;
}

/** Inputs to the pure scorer. All numeric signals are normalised to 0..1. */
export interface RankingSignals {
  relevance: number;
  preferenceMatch: number;
  quality: number;
  authenticity: number;
  localOwnership: number;
  freshness: number;
  uniqueness: number;
  popularity: number;
  crowd: number;
}

export interface RankedScore {
  score: number;
  contributions: Record<keyof RankingWeights, number>;
  reasons: string[];
}

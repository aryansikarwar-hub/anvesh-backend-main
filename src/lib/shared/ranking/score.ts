import { type RankedScore, type RankingSignals, type RankingWeights } from '../../types';
import { clamp01, round } from '../util/number';

export const RANKING_KEYS: (keyof RankingWeights)[] = [
  'relevance',
  'preferenceMatch',
  'quality',
  'authenticity',
  'localOwnership',
  'freshness',
  'uniqueness',
  'popularityPenalty',
  'crowdPenalty',
];

/** Keys whose contribution is SUBTRACTED from the score. */
export const PENALTY_KEYS = ['popularityPenalty', 'crowdPenalty'] as const;

const REASON_LABELS: Partial<Record<keyof RankingWeights, string>> = {
  preferenceMatch: 'Matches what you like',
  localOwnership: 'Locally owned',
  authenticity: 'Authentic, not touristy',
  uniqueness: 'Hard to find elsewhere',
  quality: 'Consistently well rated',
  freshness: 'Recently verified',
};

/**
 * The Anvesh discovery score.
 *
 * PRODUCT INVARIANT (docs/spec.md section 1): popularity and crowding are
 * PENALTIES. With every other signal fixed, a higher `popularity` or `crowd`
 * value must produce a strictly lower score. `ranking.invariant.spec.ts`
 * enforces this and must not be deleted or weakened.
 *
 * All weights come from the active RecommendationConfig document. Nothing here
 * is hard-coded except the shape of the formula itself.
 */
export function scoreCandidate(signals: RankingSignals, weights: RankingWeights): RankedScore {
  const s = normaliseSignals(signals);
  const contributions = {
    relevance: weights.relevance * s.relevance,
    preferenceMatch: weights.preferenceMatch * s.preferenceMatch,
    quality: weights.quality * s.quality,
    authenticity: weights.authenticity * s.authenticity,
    localOwnership: weights.localOwnership * s.localOwnership,
    freshness: weights.freshness * s.freshness,
    uniqueness: weights.uniqueness * s.uniqueness,
    popularityPenalty: weights.popularityPenalty * s.popularity,
    crowdPenalty: weights.crowdPenalty * s.crowd,
  } satisfies Record<keyof RankingWeights, number>;

  const positive =
    contributions.relevance +
    contributions.preferenceMatch +
    contributions.quality +
    contributions.authenticity +
    contributions.localOwnership +
    contributions.freshness +
    contributions.uniqueness;

  const negative = contributions.popularityPenalty + contributions.crowdPenalty;

  return {
    score: round(positive - negative),
    contributions,
    reasons: buildReasons(contributions, s),
  };
}

function normaliseSignals(signals: RankingSignals): RankingSignals {
  return {
    relevance: clamp01(signals.relevance),
    preferenceMatch: clamp01(signals.preferenceMatch),
    quality: clamp01(signals.quality),
    authenticity: clamp01(signals.authenticity),
    localOwnership: clamp01(signals.localOwnership),
    freshness: clamp01(signals.freshness),
    uniqueness: clamp01(signals.uniqueness),
    popularity: clamp01(signals.popularity),
    crowd: clamp01(signals.crowd),
  };
}

function buildReasons(
  contributions: Record<keyof RankingWeights, number>,
  signals: RankingSignals,
): string[] {
  const reasons = (Object.keys(REASON_LABELS) as (keyof RankingWeights)[])
    .filter((key) => contributions[key] > 0)
    .sort((a, b) => contributions[b] - contributions[a])
    .slice(0, 3)
    .map((key) => REASON_LABELS[key] as string);

  if (signals.crowd <= 0.25) reasons.push('Rarely crowded');
  else if (signals.popularity <= 0.2) reasons.push('Still under the radar');
  return reasons.slice(0, 3);
}

/** A place qualifies as a hidden gem only while it stays unpopular. */
export function isHiddenGem(
  signals: Pick<RankingSignals, 'popularity' | 'quality'>,
  popularityMax: number,
  minQuality: number,
): boolean {
  return clamp01(signals.popularity) <= popularityMax && clamp01(signals.quality) >= minQuality;
}

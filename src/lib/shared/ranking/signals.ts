import { type UserPreferences } from '../../types';
import { decay } from '../util/time';
import { clamp01, jaccard } from '../util/number';

export interface SignalSourcePlace {
  categorySlugs: string[];
  ownership: string;
  signals: {
    qualityScore: number;
    authenticityScore: number;
    localOwnership: number;
    uniquenessScore: number;
    popularityScore: number;
    crowdLevel: number;
    lastVerifiedAt?: string | Date | null;
  };
}

/** How well a candidate matches the traveller's stored preferences (0..1). */
export function preferenceMatch(place: SignalSourcePlace, prefs: UserPreferences | null): number {
  if (!prefs) return 0;
  const interestScore = jaccard(place.categorySlugs, prefs.interests);
  const localBonus =
    prefs.prefersLocalOwned && place.ownership === 'LOCAL_OWNED'
      ? 0.25
      : prefs.prefersLocalOwned
        ? 0
        : 0.1;
  // A crowd-averse traveller gains more from an empty place.
  const crowdFit = 1 - Math.abs(clamp01(place.signals.crowdLevel) - clamp01(prefs.crowdTolerance));
  return clamp01(interestScore * 0.55 + localBonus + crowdFit * 0.2);
}

export function freshness(
  lastVerifiedAt: string | Date | null | undefined,
  halfLifeDays: number,
  now = new Date(),
): number {
  if (!lastVerifiedAt) return 0;
  const then = lastVerifiedAt instanceof Date ? lastVerifiedAt : new Date(lastVerifiedAt);
  if (Number.isNaN(then.getTime())) return 0;
  const ageDays = Math.max(0, (now.getTime() - then.getTime()) / 86_400_000);
  return clamp01(decay(ageDays, halfLifeDays));
}

/** Text/keyword relevance blended with proximity, both already 0..1. */
export function blendRelevance(textScore: number, proximity: number): number {
  return clamp01(textScore * 0.65 + proximity * 0.35);
}

export function proximityScore(distanceKm: number | null, decayKm: number): number {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return 0;
  if (decayKm <= 0) return 0;
  return clamp01(Math.exp(-Math.max(0, distanceKm) / decayKm));
}

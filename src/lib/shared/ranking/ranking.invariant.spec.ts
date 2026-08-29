import { describe, expect, it } from 'vitest';
import { type RankingSignals, type RankingWeights } from '../../types';
import { isHiddenGem, scoreCandidate } from './score';

const WEIGHTS: RankingWeights = {
  relevance: 1.0,
  preferenceMatch: 0.9,
  quality: 0.8,
  authenticity: 0.7,
  localOwnership: 0.6,
  freshness: 0.3,
  uniqueness: 0.5,
  popularityPenalty: 1.2,
  crowdPenalty: 0.9,
};

const BASE: RankingSignals = {
  relevance: 0.7,
  preferenceMatch: 0.6,
  quality: 0.8,
  authenticity: 0.7,
  localOwnership: 0.9,
  freshness: 0.5,
  uniqueness: 0.6,
  popularity: 0.2,
  crowd: 0.2,
};

describe('PRODUCT INVARIANT: popularity is a penalty, never a boost', () => {
  it('strictly decreases the score as popularity rises', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const popularity of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const { score } = scoreCandidate({ ...BASE, popularity }, WEIGHTS);
      expect(score).toBeLessThan(previous);
      previous = score;
    }
  });

  it('strictly decreases the score as crowd level rises', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const crowd of [0, 0.25, 0.5, 0.75, 1]) {
      const { score } = scoreCandidate({ ...BASE, crowd }, WEIGHTS);
      expect(score).toBeLessThan(previous);
      previous = score;
    }
  });

  it('ranks the less popular of two otherwise identical places higher', () => {
    const quiet = scoreCandidate({ ...BASE, popularity: 0.1, crowd: 0.1 }, WEIGHTS).score;
    const famous = scoreCandidate({ ...BASE, popularity: 0.95, crowd: 0.95 }, WEIGHTS).score;
    expect(quiet).toBeGreaterThan(famous);
  });

  it('takes every weight from the supplied config and nowhere else', () => {
    const zeroed = Object.fromEntries(
      Object.keys(WEIGHTS).map((k) => [k, 0]),
    ) as unknown as RankingWeights;
    expect(scoreCandidate(BASE, zeroed).score).toBe(0);
  });
});

describe('positive signals raise the score', () => {
  it.each(['quality', 'authenticity', 'localOwnership', 'uniqueness', 'preferenceMatch'] as const)(
    '%s increases the score',
    (key) => {
      const low = scoreCandidate({ ...BASE, [key]: 0.1 }, WEIGHTS).score;
      const high = scoreCandidate({ ...BASE, [key]: 0.9 }, WEIGHTS).score;
      expect(high).toBeGreaterThan(low);
    },
  );
});

describe('scoreCandidate hardening', () => {
  it('clamps out-of-range signals instead of producing NaN', () => {
    const { score } = scoreCandidate(
      { ...BASE, popularity: 42, quality: -3, relevance: Number.NaN },
      WEIGHTS,
    );
    expect(Number.isFinite(score)).toBe(true);
  });

  it('surfaces at most three human-readable reasons', () => {
    expect(scoreCandidate(BASE, WEIGHTS).reasons.length).toBeLessThanOrEqual(3);
  });
});

describe('isHiddenGem', () => {
  it('requires low popularity and decent quality', () => {
    expect(isHiddenGem({ popularity: 0.1, quality: 0.8 }, 0.3, 0.6)).toBe(true);
    expect(isHiddenGem({ popularity: 0.9, quality: 0.9 }, 0.3, 0.6)).toBe(false);
    expect(isHiddenGem({ popularity: 0.1, quality: 0.2 }, 0.3, 0.6)).toBe(false);
  });
});

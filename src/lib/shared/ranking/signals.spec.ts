import { describe, expect, it } from 'vitest';
import { type UserPreferences } from '../../types';
import {
  blendRelevance,
  freshness,
  preferenceMatch,
  proximityScore,
  type SignalSourcePlace,
} from './signals';

const prefs: UserPreferences = {
  interests: ['waterfall', 'trek', 'local-food'],
  travelStyles: ['slow'],
  budgetBand: 'MID',
  crowdTolerance: 0.2,
  prefersLocalOwned: true,
  dietary: [],
  languages: ['hi', 'en'],
};

function place(over: Partial<SignalSourcePlace> = {}): SignalSourcePlace {
  return {
    categorySlugs: ['waterfall', 'trek'],
    ownership: 'LOCAL_OWNED',
    signals: {
      qualityScore: 0.8,
      authenticityScore: 0.8,
      localOwnership: 1,
      uniquenessScore: 0.7,
      popularityScore: 0.1,
      crowdLevel: 0.2,
      lastVerifiedAt: new Date().toISOString(),
    },
    ...over,
  };
}

describe('preferenceMatch', () => {
  it('is 0 without preferences', () => {
    expect(preferenceMatch(place(), null)).toBe(0);
  });

  it('rewards overlapping interests', () => {
    expect(preferenceMatch(place(), prefs)).toBeGreaterThan(
      preferenceMatch(place({ categorySlugs: ['nightlife'] }), prefs),
    );
  });

  it('rewards locally owned places for travellers who ask for them', () => {
    expect(preferenceMatch(place(), prefs)).toBeGreaterThan(
      preferenceMatch(place({ ownership: 'CHAIN' }), prefs),
    );
  });

  it('rewards quiet places for crowd-averse travellers', () => {
    const packed = place({ signals: { ...place().signals, crowdLevel: 1 } });
    expect(preferenceMatch(place(), prefs)).toBeGreaterThan(preferenceMatch(packed, prefs));
  });
});

describe('freshness', () => {
  it('is 1 for a just-verified place and halves after one half-life', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(freshness(now, 90, now)).toBeCloseTo(1, 5);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
    expect(freshness(ninetyDaysAgo, 90, now)).toBeCloseTo(0.5, 5);
  });

  it('is 0 for missing or invalid input', () => {
    expect(freshness(null, 90)).toBe(0);
    expect(freshness('not-a-date', 90)).toBe(0);
  });
});

describe('proximityScore', () => {
  it('decays with distance and is 0 when distance is unknown', () => {
    expect(proximityScore(0, 25)).toBeCloseTo(1, 5);
    expect(proximityScore(25, 25)).toBeLessThan(proximityScore(5, 25));
    expect(proximityScore(null, 25)).toBe(0);
  });
});

describe('blendRelevance', () => {
  it('stays within 0..1', () => {
    expect(blendRelevance(1, 1)).toBeLessThanOrEqual(1);
    expect(blendRelevance(0, 0)).toBe(0);
  });
});

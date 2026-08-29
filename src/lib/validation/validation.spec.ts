import { describe, expect, it } from 'vitest';
import { geoPointSchema, minorAmountSchema, objectIdSchema, paginationQuerySchema } from './common';
import { loginSchema, passwordSchema, registerSchema } from './auth';
import { placeCreateSchema } from './place';
import { bookingCreateSchema } from './booking';
import { searchQuerySchema } from './discovery';
import { aiDiscoveryOutputSchema, aiItineraryOutputSchema } from './ai';
import { recommendationWeightsSchema } from './admin';
import { tripActivityInputSchema } from './trip';

const OID = '65f1c2d3e4b5a60718293a4b';

describe('common schemas', () => {
  it('accepts only 24-hex object ids', () => {
    expect(objectIdSchema.safeParse(OID).success).toBe(true);
    expect(objectIdSchema.safeParse('123').success).toBe(false);
    expect(objectIdSchema.safeParse({ $ne: null }).success).toBe(false);
  });

  it('requires GeoJSON points to be [lng, lat] in range', () => {
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [77.59, 12.97] }).success).toBe(
      true,
    );
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [12.97, 200] }).success).toBe(
      false,
    );
  });

  it('rejects fractional money', () => {
    expect(minorAmountSchema.safeParse(99950).success).toBe(true);
    expect(minorAmountSchema.safeParse(999.5).success).toBe(false);
    expect(minorAmountSchema.safeParse(-1).success).toBe(false);
  });

  it('coerces and caps pagination', () => {
    const parsed = paginationQuerySchema.parse({ page: '2', limit: '20' });
    expect(parsed).toEqual({ page: 2, limit: 20 });
    expect(paginationQuerySchema.safeParse({ page: 1, limit: 5000 }).success).toBe(false);
  });
});

describe('auth schemas', () => {
  it('enforces the password policy', () => {
    expect(passwordSchema.safeParse('Str0ngPassword').success).toBe(true);
    expect(passwordSchema.safeParse('short1A').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
  });

  it('never lets a client choose its own role or portal at registration', () => {
    const bad = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'Str0ngPassword',
      displayName: 'Aarav',
      accountType: 'TRAVELLER',
      acceptTerms: true,
      role: 'ADMIN',
    });
    expect(bad.success).toBe(false);
  });

  it('refuses ADMIN as a self-service account type', () => {
    const res = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'Str0ngPassword',
      displayName: 'Aarav',
      accountType: 'ADMIN',
      acceptTerms: true,
    });
    expect(res.success).toBe(false);
  });

  it('requires an explicit portal at login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: 'x', portal: 'TOURIST_GUIDE' }).success,
    ).toBe(true);
  });
});

describe('content schemas', () => {
  const validPlace = {
    title: 'Bandaje Arbi Falls',
    summary: 'A steep trek to a wide falls above Ujire, best after the monsoon.',
    description:
      'Bandaje Arbi is a plunge waterfall in the Western Ghats reached by a long forest trek from Ujire in Dakshina Kannada.',
    categorySlugs: ['waterfall', 'trek'],
    location: { type: 'Point', coordinates: [75.35, 12.99] },
    address: { city: 'Ujire', state: 'Karnataka', country: 'IN' },
  };

  it('accepts a well-formed place', () => {
    expect(placeCreateSchema.safeParse(validPlace).success).toBe(true);
  });

  it('refuses guide-declared popularity or crowd signals', () => {
    const res = placeCreateSchema.safeParse({
      ...validPlace,
      selfDeclared: { localOwnership: 1, popularityScore: 0, crowdLevel: 0 },
    });
    expect(res.success).toBe(false);
  });

  it('refuses a guideId supplied by the client', () => {
    expect(placeCreateSchema.safeParse({ ...validPlace, guideId: OID }).success).toBe(false);
  });
});

describe('booking schema', () => {
  it('accepts only slot and seats, never prices', () => {
    expect(bookingCreateSchema.safeParse({ slotId: OID, seats: 2 }).success).toBe(true);
    expect(
      bookingCreateSchema.safeParse({ slotId: OID, seats: 2, totalMinor: 1 }).success,
    ).toBe(false);
    expect(bookingCreateSchema.safeParse({ slotId: OID, seats: 0 }).success).toBe(false);
  });
});

describe('discovery schema', () => {
  it('has no way to sort by popularity', () => {
    expect(searchQuerySchema.safeParse({ sort: 'popular' }).success).toBe(false);
    expect(searchQuerySchema.parse({}).sort).toBe('recommended');
  });

  it('splits a comma separated category list', () => {
    expect(searchQuerySchema.parse({ categories: 'waterfall, trek' }).categories).toEqual([
      'waterfall',
      'trek',
    ]);
  });
});

describe('AI output schemas', () => {
  it('rejects a hallucinated non-id reference before it reaches the database check', () => {
    const res = aiDiscoveryOutputSchema.safeParse({
      answer: 'Try these',
      placeIds: ['the-secret-waterfall-near-coorg'],
      highlights: [],
      followUps: [],
    });
    expect(res.success).toBe(false);
  });

  it('accepts a well-formed itinerary', () => {
    const res = aiItineraryOutputSchema.safeParse({
      title: 'Three quiet days in Coorg',
      summary: 'Low-crowd plantations, waterfalls and a homestay kitchen.',
      days: [
        {
          dayNumber: 1,
          title: 'Arrive and settle',
          activities: [{ kind: 'PLACE', placeId: OID, title: 'Mandalpatti', durationMin: 180 }],
        },
      ],
    });
    expect(res.success).toBe(true);
  });
});

describe('recommendation weights', () => {
  it('will not allow popularity to become a boost', () => {
    const base = {
      relevance: 1,
      preferenceMatch: 1,
      quality: 1,
      authenticity: 1,
      localOwnership: 1,
      freshness: 1,
      uniqueness: 1,
      popularityPenalty: 1,
      crowdPenalty: 1,
    };
    expect(recommendationWeightsSchema.safeParse(base).success).toBe(true);
    expect(
      recommendationWeightsSchema.safeParse({ ...base, popularityPenalty: 0 }).success,
    ).toBe(false);
    expect(
      recommendationWeightsSchema.safeParse({ ...base, popularityPenalty: -1 }).success,
    ).toBe(false);
  });
});

describe('trip activity schema', () => {
  it('requires an id for PLACE and EXPERIENCE activities', () => {
    expect(tripActivityInputSchema.safeParse({ kind: 'PLACE', title: 'x' }).success).toBe(false);
    expect(
      tripActivityInputSchema.safeParse({ kind: 'PLACE', placeId: OID, title: 'x' }).success,
    ).toBe(true);
    expect(tripActivityInputSchema.safeParse({ kind: 'NOTE', title: 'Pack a poncho' }).success).toBe(
      true,
    );
  });
});

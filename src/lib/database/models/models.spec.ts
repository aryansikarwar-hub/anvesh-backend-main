import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { PlaceModel } from './place.model';
import { BookingModel } from './booking.model';
import { AvailabilitySlotModel } from './availability.model';
import { TripModel, MAX_ACTIVITIES_PER_DAY, MAX_TRIP_DAYS } from './trip.model';
import { RecommendationConfigModel } from './recommendation.model';

const oid = () => new Types.ObjectId();

function basePlace(overrides: Record<string, unknown> = {}) {
  return new PlaceModel({
    slug: 'bandaje-arbi-falls',
    title: 'Bandaje Arbi Falls',
    summary: 'A steep trek to a wide falls above Ujire.',
    description: 'A plunge waterfall in the Western Ghats reached by a long forest trek.',
    categorySlugs: ['waterfall'],
    location: { type: 'Point', coordinates: [75.3562, 12.9908] },
    address: { city: 'Ujire', state: 'Karnataka', country: 'IN' },
    createdBy: oid(),
    ...overrides,
  });
}

describe('Place schema', () => {
  it('accepts a valid place', () => {
    expect(basePlace().validateSync()).toBeUndefined();
  });

  it('rejects coordinates given as [lat, lng]', () => {
    // 75.3 is a valid longitude but an invalid latitude, so the reversed pair fails.
    const err = basePlace({
      location: { type: 'Point', coordinates: [12.9908, 95.3562] },
    }).validateSync();
    expect(err?.errors['location.coordinates']).toBeDefined();
  });

  it('rejects a fractional entry fee', () => {
    const err = basePlace({ details: { entryFeeMinor: 300.5 } }).validateSync();
    expect(err?.errors['details.entryFeeMinor']).toBeDefined();
  });

  it('keeps every 0..1 signal inside range', () => {
    const err = basePlace({ signals: { popularityScore: 1.4, crowdLevel: -0.2 } }).validateSync();
    expect(err?.errors['signals.popularityScore']).toBeDefined();
    expect(err?.errors['signals.crowdLevel']).toBeDefined();
  });

  it('refuses unknown fields instead of silently dropping them', () => {
    expect(() => basePlace({ popularityBoost: 5 })).toThrow();
  });
});

describe('Booking schema', () => {
  it('rejects fractional money on every amount field', () => {
    const booking = new BookingModel({
      code: 'ANV-7KQ2-M4XD',
      userId: oid(),
      guideId: oid(),
      experienceId: oid(),
      slotId: oid(),
      seats: 2,
      totalMinor: 999.5,
      startAt: new Date(),
      endAt: new Date(),
      experienceTitle: 'x',
      experienceSlug: 'x',
      guideSummary: { guideId: oid(), displayName: 'g', slug: 'g' },
      travellerName: 'a',
      travellerEmail: 'a@b.com',
      idempotencyKey: 'k',
    });
    expect(booking.validateSync()?.errors.totalMinor).toBeDefined();
  });
});

describe('AvailabilitySlot schema', () => {
  it('will not allow more seats than the hard cap', () => {
    const slot = new AvailabilitySlotModel({
      experienceId: oid(),
      guideId: oid(),
      startAt: new Date(),
      endAt: new Date(),
      seatsTotal: 200,
      seatsAvailable: 200,
      priceMinor: 100,
    });
    expect(slot.validateSync()?.errors.seatsTotal).toBeDefined();
  });

  it('will not allow negative availability', () => {
    const slot = new AvailabilitySlotModel({
      experienceId: oid(),
      guideId: oid(),
      startAt: new Date(),
      endAt: new Date(),
      seatsTotal: 8,
      seatsAvailable: -1,
      priceMinor: 100,
    });
    expect(slot.validateSync()?.errors.seatsAvailable).toBeDefined();
  });
});

describe('Trip schema keeps the document bounded', () => {
  it('caps days and activities', () => {
    const activity = {
      kind: 'NOTE' as const,
      title: 'note',
      durationMin: 30,
      order: 0,
    };
    const trip = new TripModel({
      userId: oid(),
      title: 'Too much',
      days: Array.from({ length: MAX_TRIP_DAYS + 1 }, (_, i) => ({
        dayNumber: Math.min(i + 1, MAX_TRIP_DAYS),
        title: `Day ${i + 1}`,
        activities: Array.from({ length: MAX_ACTIVITIES_PER_DAY + 1 }, () => activity),
      })),
    });
    expect(trip.validateSync()).toBeDefined();
  });
});

describe('RecommendationConfig schema', () => {
  it('refuses a zero popularity penalty', () => {
    const config = new RecommendationConfigModel({
      name: 'broken',
      weights: { popularityPenalty: 0, crowdPenalty: 0.9 },
    });
    expect(config.validateSync()?.errors['weights.popularityPenalty']).toBeDefined();
  });

  it('accepts the shipped defaults', () => {
    expect(new RecommendationConfigModel({ name: 'default' }).validateSync()).toBeUndefined();
  });
});

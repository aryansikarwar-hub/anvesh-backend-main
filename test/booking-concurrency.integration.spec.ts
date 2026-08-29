import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AvailabilitySlotModel, BookingModel } from '../src/lib/database';
import { IDEMPOTENCY_HEADER } from '../src/lib/types';
import {
  accessToken,
  bearer,
  createUser,
  resetDatabase,
  startHarness,
  stopHarness,
  type Harness,
  type TestUser,
} from './harness';
import { createExperience, createSlot } from './fixtures';

/**
 * Booking concurrency.
 *
 * The seat hold is a single conditional `findOneAndUpdate` with
 * `seatsAvailable: { $gte: n }` and `$inc`. No application lock exists, so the
 * only thing standing between two travellers and a double-booked seat is that
 * update being atomic. These tests fire the requests in parallel and assert on
 * the aggregate outcome rather than on who happened to win.
 */
describe('booking concurrency', () => {
  let harness: Harness;
  let guide: TestUser;
  let experienceId: string;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await stopHarness();
  });

  beforeEach(async () => {
    await resetDatabase();
    guide = await createUser({
      role: 'TOURIST_GUIDE',
      portals: ['TRAVELLER', 'TOURIST_GUIDE'],
      withGuideProfile: true,
    });
    const experience = await createExperience({ guideId: guide.guideId as string, maxSeats: 10 });
    experienceId = String(experience._id);
  });

  async function travellers(count: number): Promise<TestUser[]> {
    const users: TestUser[] = [];
    for (let i = 0; i < count; i += 1) {
      users.push(await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] }));
    }
    return users;
  }

  function book(user: TestUser, slotId: string, seats: number) {
    return request(harness.app)
      .post('/api/v1/bookings')
      .set(...bearer(accessToken(harness, user, 'TRAVELLER')))
      .set(IDEMPOTENCY_HEADER, `${user.id}-${slotId}-${seats}`)
      .send({ slotId, seats });
  }

  it('gives the last seat to exactly one of ten simultaneous travellers', async () => {
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal: 1,
    });
    const slotId = String(slot._id);
    const users = await travellers(10);

    const results = await Promise.all(users.map((user) => book(user, slotId, 1)));

    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status !== 201);

    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const res of rejected) {
      expect(res.body.error.code).toBe('SLOT_SOLD_OUT');
    }

    const after = await AvailabilitySlotModel.findById(slotId).lean();
    expect(after?.seatsAvailable).toBe(0);
    expect(await BookingModel.countDocuments({ slotId })).toBe(1);
  });

  it('never oversells when many travellers race for a handful of seats', async () => {
    const seatsTotal = 5;
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal,
    });
    const slotId = String(slot._id);
    const users = await travellers(20);

    const results = await Promise.all(users.map((user) => book(user, slotId, 1)));
    const created = results.filter((r) => r.status === 201);

    expect(created).toHaveLength(seatsTotal);

    const after = await AvailabilitySlotModel.findById(slotId).lean();
    expect(after?.seatsAvailable).toBe(0);

    const bookings = await BookingModel.find({ slotId }).lean();
    const bookedSeats = bookings.reduce((sum, b) => sum + b.seats, 0);
    expect(bookedSeats).toBe(seatsTotal);
  });

  it('does not partially fill a multi-seat request that cannot be satisfied', async () => {
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal: 3,
    });
    const slotId = String(slot._id);
    const [a, b] = await travellers(2);

    // Both ask for 2 of the 3 seats. One must fail outright rather than being
    // given a single seat.
    const results = await Promise.all([
      book(a as TestUser, slotId, 2),
      book(b as TestUser, slotId, 2),
    ]);

    const created = results.filter((r) => r.status === 201);
    expect(created).toHaveLength(1);
    expect(created[0]?.body.data.booking.seats).toBe(2);

    const after = await AvailabilitySlotModel.findById(slotId).lean();
    expect(after?.seatsAvailable).toBe(1);
  });

  it('treats a repeated idempotency key as the same booking, not a second hold', async () => {
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal: 4,
    });
    const slotId = String(slot._id);
    const [user] = await travellers(1);
    const key = `retry-${slotId}`;

    const send = () =>
      request(harness.app)
        .post('/api/v1/bookings')
        .set(...bearer(accessToken(harness, user as TestUser, 'TRAVELLER')))
        .set(IDEMPOTENCY_HEADER, key)
        .send({ slotId, seats: 2 });

    const first = await send();
    expect(first.status).toBe(201);

    const second = await send();
    expect(second.status).toBeLessThan(300);
    expect(second.body.data.booking.id).toBe(first.body.data.booking.id);

    const after = await AvailabilitySlotModel.findById(slotId).lean();
    expect(after?.seatsAvailable).toBe(2);
    expect(await BookingModel.countDocuments({ slotId })).toBe(1);
  });

  it('rejects another traveller reusing someone else’s idempotency key', async () => {
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal: 4,
    });
    const slotId = String(slot._id);
    const [a, b] = await travellers(2);
    const key = `shared-${slotId}`;

    const first = await request(harness.app)
      .post('/api/v1/bookings')
      .set(...bearer(accessToken(harness, a as TestUser, 'TRAVELLER')))
      .set(IDEMPOTENCY_HEADER, key)
      .send({ slotId, seats: 1 });
    expect(first.status).toBe(201);

    const second = await request(harness.app)
      .post('/api/v1/bookings')
      .set(...bearer(accessToken(harness, b as TestUser, 'TRAVELLER')))
      .set(IDEMPOTENCY_HEADER, key)
      .send({ slotId, seats: 1 });

    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses to book a slot that has already started', async () => {
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal: 4,
      startInDays: 14,
    });
    // Move the slot into the past directly, bypassing the create-time guard.
    await AvailabilitySlotModel.updateOne(
      { _id: slot._id },
      { $set: { startAt: new Date(Date.now() - 3_600_000), endAt: new Date() } },
    );

    const [user] = await travellers(1);
    const res = await book(user as TestUser, String(slot._id), 1);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(['SLOT_IN_PAST', 'SLOT_NOT_FOUND']).toContain(res.body.error.code);
    expect(await BookingModel.countDocuments({ slotId: slot._id })).toBe(0);
  });

  it('refuses to book a closed slot', async () => {
    const slot = await createSlot({
      experienceId,
      guideId: guide.guideId as string,
      seatsTotal: 4,
    });
    await AvailabilitySlotModel.updateOne({ _id: slot._id }, { $set: { status: 'CLOSED' } });

    const [user] = await travellers(1);
    const res = await book(user as TestUser, String(slot._id), 1);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(['SLOT_CLOSED', 'SLOT_NOT_FOUND']).toContain(res.body.error.code);
    expect(await BookingModel.countDocuments({ slotId: slot._id })).toBe(0);
  });
});

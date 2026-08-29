import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PlaceModel } from '../src/lib/database';
import {
  resetDatabase,
  startHarness,
  stopHarness,
  type Harness,
} from './harness';
import { createPlace, seedRankingConfig } from './fixtures';

interface Card {
  id: string;
  slug: string;
  title: string;
  score?: number;
  crowdLevel: number;
}

/**
 * Discovery ranking, end to end against real documents.
 *
 * The product rule under test is the one that must never be optimised away:
 * popularity and crowding SUBTRACT from a place's score. Everything else about
 * two candidates is held equal so that only the penalty can explain the order.
 */
describe('discovery ranking', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await stopHarness();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRankingConfig();
  });

  async function feed(): Promise<Card[]> {
    const res = await request(harness.app).get('/api/v1/discovery/feed?limit=40');
    expect(res.status).toBe(200);
    return res.body.data.items as Card[];
  }

  it('ranks the less popular of two otherwise identical places higher', async () => {
    const quiet = await createPlace({
      slug: 'quiet-twin',
      title: 'Quiet Twin',
      popularity: 0.05,
      crowd: 0.1,
      quality: 0.8,
    });
    const famous = await createPlace({
      slug: 'famous-twin',
      title: 'Famous Twin',
      popularity: 0.95,
      crowd: 0.1,
      quality: 0.8,
    });

    const items = await feed();
    const quietIndex = items.findIndex((i) => i.id === String(quiet._id));
    const famousIndex = items.findIndex((i) => i.id === String(famous._id));

    expect(quietIndex).toBeGreaterThanOrEqual(0);
    expect(famousIndex).toBeGreaterThanOrEqual(0);
    expect(quietIndex).toBeLessThan(famousIndex);
    expect(items[quietIndex]?.score).toBeGreaterThan(items[famousIndex]?.score as number);
  });

  it('ranks the less crowded of two otherwise identical places higher', async () => {
    const empty = await createPlace({
      slug: 'empty-twin',
      title: 'Empty Twin',
      popularity: 0.2,
      crowd: 0.05,
      quality: 0.8,
    });
    const packed = await createPlace({
      slug: 'packed-twin',
      title: 'Packed Twin',
      popularity: 0.2,
      crowd: 0.95,
      quality: 0.8,
    });

    const items = await feed();
    const emptyIndex = items.findIndex((i) => i.id === String(empty._id));
    const packedIndex = items.findIndex((i) => i.id === String(packed._id));

    expect(emptyIndex).toBeLessThan(packedIndex);
  });

  it('lets higher quality outrank a quieter but much worse place', async () => {
    // The penalty is a weight, not a veto — quality still has to be able to win.
    const good = await createPlace({
      slug: 'good-but-known',
      popularity: 0.35,
      crowd: 0.2,
      quality: 0.95,
    });
    const poor = await createPlace({
      slug: 'obscure-but-poor',
      popularity: 0.01,
      crowd: 0.01,
      quality: 0.25,
    });

    const items = await feed();
    const goodIndex = items.findIndex((i) => i.id === String(good._id));
    const poorIndex = items.findIndex((i) => i.id === String(poor._id));

    expect(goodIndex).toBeGreaterThanOrEqual(0);
    expect(poorIndex).toBeGreaterThanOrEqual(0);
    expect(goodIndex).toBeLessThan(poorIndex);
  });

  it('exposes no way to sort by popularity', async () => {
    const res = await request(harness.app).get('/api/v1/discovery/search?sort=popular');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('offers a quietest sort that puts the least crowded place first', async () => {
    await createPlace({ slug: 'busy-one', crowd: 0.9 });
    const calm = await createPlace({ slug: 'calm-one', crowd: 0.05 });

    const res = await request(harness.app).get('/api/v1/discovery/search?sort=quietest&limit=10');
    expect(res.status).toBe(200);
    const items = res.body.data.items as Card[];
    expect(items[0]?.id).toBe(String(calm._id));
  });

  it('returns only genuinely unpopular places from hidden gems', async () => {
    const gem = await createPlace({
      slug: 'real-gem',
      popularity: 0.05,
      crowd: 0.05,
      quality: 0.9,
    });
    const overrun = await createPlace({
      slug: 'tourist-trap',
      popularity: 0.98,
      crowd: 0.95,
      quality: 0.9,
    });

    const res = await request(harness.app).get('/api/v1/discovery/hidden-gems?limit=20');
    expect(res.status).toBe(200);
    const ids = (res.body.data.items as Card[]).map((i) => i.id);

    expect(ids).toContain(String(gem._id));
    expect(ids).not.toContain(String(overrun._id));
  });

  it('excludes unpublished places from every public surface', async () => {
    const draft = await createPlace({ slug: 'draft-place', status: 'DRAFT' });
    const pending = await createPlace({ slug: 'pending-place', status: 'PENDING_REVIEW' });
    const live = await createPlace({ slug: 'live-place' });

    const ids = (await feed()).map((i) => i.id);
    expect(ids).toContain(String(live._id));
    expect(ids).not.toContain(String(draft._id));
    expect(ids).not.toContain(String(pending._id));
  });

  it('excludes soft-deleted places', async () => {
    const removed = await createPlace({ slug: 'removed-place' });
    await PlaceModel.updateOne({ _id: removed._id }, { $set: { deletedAt: new Date() } });

    const ids = (await feed()).map((i) => i.id);
    expect(ids).not.toContain(String(removed._id));
  });

  it('finds nearby places by distance and reports the distance back', async () => {
    // Roughly 3 km apart along the same latitude.
    const near = await createPlace({ slug: 'near-place', lng: 75.3562, lat: 12.9908 });
    await createPlace({ slug: 'far-place', lng: 78.9, lat: 20.5 });

    const res = await request(harness.app).get(
      '/api/v1/discovery/nearby?lng=75.3562&lat=12.9908&radiusKm=10&limit=10',
    );

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<Card & { distanceKm?: number }>;
    expect(items.map((i) => i.id)).toEqual([String(near._id)]);
    expect(items[0]?.distanceKm).toBeLessThan(1);
  });

  it('restricts the map endpoint to the requested bounding box', async () => {
    const inside = await createPlace({ slug: 'inside-box', lng: 75.35, lat: 12.99 });
    const outside = await createPlace({ slug: 'outside-box', lng: 88.36, lat: 22.57 });

    const res = await request(harness.app).get(
      '/api/v1/discovery/map?west=75&south=12&east=76&north=13&limit=50',
    );

    expect(res.status).toBe(200);
    const ids = (res.body.data.items as Card[]).map((i) => i.id);
    expect(ids).toContain(String(inside._id));
    expect(ids).not.toContain(String(outside._id));
  });

  it('rejects an out-of-range coordinate instead of querying with it', async () => {
    const res = await request(harness.app).get(
      '/api/v1/discovery/nearby?lng=999&lat=12.99&radiusKm=10',
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

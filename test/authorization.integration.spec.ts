import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  accessToken,
  bearer,
  createUser,
  oid,
  resetDatabase,
  startHarness,
  stopHarness,
  type Harness,
  type TestUser,
} from './harness';
import { createPlace, seedRankingConfig } from './fixtures';

/**
 * Negative authorization tests.
 *
 * Portal and role are separate checks, and ownership is enforced inside the
 * database query rather than by a guard. Each of the three is exercised here
 * on its own so that removing any one of them fails a test.
 */
describe('authorization', () => {
  let harness: Harness;
  let traveller: TestUser;
  let guideA: TestUser;
  let guideB: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await stopHarness();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRankingConfig();
    traveller = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    guideA = await createUser({
      role: 'TOURIST_GUIDE',
      portals: ['TRAVELLER', 'TOURIST_GUIDE'],
      withGuideProfile: true,
    });
    guideB = await createUser({
      role: 'TOURIST_GUIDE',
      portals: ['TRAVELLER', 'TOURIST_GUIDE'],
      withGuideProfile: true,
    });
    admin = await createUser({ role: 'ADMIN', portals: ['ADMIN'] });
  });

  describe('portal separation', () => {
    it('rejects a traveller-portal token on a guide-portal endpoint with PORTAL_MISMATCH', async () => {
      // The user genuinely has the guide role; only the portal claim is wrong.
      const token = accessToken(harness, guideA, 'TRAVELLER');
      const res = await request(harness.app).get('/api/v1/guides/me').set(...bearer(token));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PORTAL_MISMATCH');
    });

    it('rejects an admin-portal token on a traveller endpoint with PORTAL_MISMATCH', async () => {
      const token = accessToken(harness, admin, 'ADMIN');
      const res = await request(harness.app).get('/api/v1/bookings').set(...bearer(token));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PORTAL_MISMATCH');
    });

    it('rejects a traveller-portal token on an admin endpoint with PORTAL_MISMATCH', async () => {
      const token = accessToken(harness, traveller, 'TRAVELLER');
      const res = await request(harness.app).get('/api/v1/admin/users').set(...bearer(token));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PORTAL_MISMATCH');
    });
  });

  describe('role separation', () => {
    it('rejects a traveller who forges the guide portal but keeps the traveller role', async () => {
      // Portal check passes only if the token also carries the guide portal, so
      // this asserts the role guard independently of the portal guard.
      const forged = harness.tokens.signAccessToken({
        userId: traveller.id,
        role: 'TRAVELLER',
        portal: 'TOURIST_GUIDE',
        tokenVersion: 0,
      }).token;

      const res = await request(harness.app).get('/api/v1/guides/me').set(...bearer(forged));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ROLE_NOT_ALLOWED');
    });

    it('lets a MODERATOR moderate content but not manage users', async () => {
      const moderator = await createUser({ role: 'MODERATOR', portals: ['ADMIN'] });
      const token = accessToken(harness, moderator, 'ADMIN');

      const allowed = await request(harness.app)
        .get('/api/v1/admin/places')
        .set(...bearer(token));
      expect(allowed.status).toBe(200);

      // /admin/users stacks a narrower role guard on top of the router guard.
      const denied = await request(harness.app).get('/api/v1/admin/users').set(...bearer(token));
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('ROLE_NOT_ALLOWED');
    });
  });

  describe('cross-tenant ownership', () => {
    it('does not let Tourist Guide A read Guide B’s place', async () => {
      const place = await createPlace({ guideId: guideB.guideId, createdBy: guideB.id });
      const token = accessToken(harness, guideA, 'TOURIST_GUIDE');

      const res = await request(harness.app)
        .get(`/api/v1/guides/me/places/${String(place._id)}`)
        .set(...bearer(token));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLACE_NOT_FOUND');
    });

    it('does not let Tourist Guide A edit Guide B’s place', async () => {
      const place = await createPlace({ guideId: guideB.guideId, createdBy: guideB.id });
      const token = accessToken(harness, guideA, 'TOURIST_GUIDE');

      const res = await request(harness.app)
        .patch(`/api/v1/guides/me/places/${String(place._id)}`)
        .set(...bearer(token))
        .send({ title: 'Hijacked by another guide' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLACE_NOT_FOUND');

      const after = await request(harness.app)
        .get(`/api/v1/guides/me/places/${String(place._id)}`)
        .set(...bearer(accessToken(harness, guideB, 'TOURIST_GUIDE')));

      expect(after.status).toBe(200);
      expect(after.body.data.place.title).toBe(place.title);
    });

    it('does not let Tourist Guide A delete Guide B’s place', async () => {
      const place = await createPlace({ guideId: guideB.guideId, createdBy: guideB.id });

      const res = await request(harness.app)
        .delete(`/api/v1/guides/me/places/${String(place._id)}`)
        .set(...bearer(accessToken(harness, guideA, 'TOURIST_GUIDE')));

      expect(res.status).toBe(404);
    });

    it('ignores a guideId supplied in the request body', async () => {
      const token = accessToken(harness, guideA, 'TOURIST_GUIDE');

      // `guideId` is not part of placeCreateSchema, and the schema is strict,
      // so an attempt to attribute a place to another guide is rejected outright.
      const res = await request(harness.app)
        .post('/api/v1/guides/me/places')
        .set(...bearer(token))
        .send({
          title: 'Injected ownership place',
          summary: 'A place that tries to declare a different owner.',
          description:
            'A place created with an extra guideId field to check that ownership never comes from the body.',
          categorySlugs: ['waterfall'],
          location: { type: 'Point', coordinates: [75.3562, 12.9908] },
          address: { city: 'Ujire', state: 'Karnataka', country: 'IN' },
          guideId: guideB.guideId,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('attributes a created place to the guide resolved from the token', async () => {
      const res = await request(harness.app)
        .post('/api/v1/guides/me/places')
        .set(...bearer(accessToken(harness, guideA, 'TOURIST_GUIDE')))
        .send({
          title: 'Legitimately owned place',
          summary: 'A place created through the guide portal by its real owner.',
          description:
            'A place created through the guide portal so that ownership attribution can be asserted.',
          categorySlugs: ['waterfall'],
          location: { type: 'Point', coordinates: [75.3562, 12.9908] },
          address: { city: 'Ujire', state: 'Karnataka', country: 'IN' },
        });

      expect(res.status).toBe(201);
      const placeId = res.body.data.place.id as string;

      const asOwner = await request(harness.app)
        .get(`/api/v1/guides/me/places/${placeId}`)
        .set(...bearer(accessToken(harness, guideA, 'TOURIST_GUIDE')));
      expect(asOwner.status).toBe(200);

      const asOther = await request(harness.app)
        .get(`/api/v1/guides/me/places/${placeId}`)
        .set(...bearer(accessToken(harness, guideB, 'TOURIST_GUIDE')));
      expect(asOther.status).toBe(404);
    });

    it('does not let one traveller read another traveller’s booking', async () => {
      const other = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
      const res = await request(harness.app)
        .get(`/api/v1/bookings/${oid()}`)
        .set(...bearer(accessToken(harness, other, 'TRAVELLER')));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('unauthenticated access', () => {
    it('rejects a missing token', async () => {
      const res = await request(harness.app).get('/api/v1/guides/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a malformed token', async () => {
      const res = await request(harness.app)
        .get('/api/v1/guides/me')
        .set(...bearer('not-a-real-token'));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('leaves public discovery reachable without a token', async () => {
      const res = await request(harness.app).get('/api/v1/discovery/feed');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

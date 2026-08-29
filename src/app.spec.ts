import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { type Express } from 'express';
import { parseConfig } from './lib/config';
import { createApp } from './app';
import { createContainer } from './container';
import { configureRateLimiting } from './common/middleware/rate-limit';
import { createLogger } from './common/logger';
import { TokenService } from './modules/auth/token.service';

const SECRET = 'a'.repeat(40);
const config = parseConfig({
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/anvesh-test',
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: SECRET,
  TOTP_ENCRYPTION_KEY: SECRET,
  RATE_LIMIT_ENABLED: 'false',
  AI_PROVIDER: 'stub',
});

const tokens = new TokenService(config.env);
let app: Express;

const traveller = tokens.signAccessToken({
  userId: '65f1c2d3e4b5a60718293a4b',
  role: 'TRAVELLER',
  portal: 'TRAVELLER',
  tokenVersion: 0,
}).token;

const guide = tokens.signAccessToken({
  userId: '65f1c2d3e4b5a60718293a4c',
  role: 'TOURIST_GUIDE',
  portal: 'TOURIST_GUIDE',
  tokenVersion: 0,
}).token;

const admin = tokens.signAccessToken({
  userId: '65f1c2d3e4b5a60718293a4d',
  role: 'ADMIN',
  portal: 'ADMIN',
  tokenVersion: 0,
}).token;

beforeAll(() => {
  createLogger('fatal', false);
  app = createApp(createContainer(config));
  configureRateLimiting(false);
});

/**
 * These assertions run entirely in the HTTP layer: they are decided by the
 * guards before any handler touches MongoDB, so they hold without a database.
 */
describe('application wiring', () => {
  it('serves liveness under /api/v1', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.meta.requestId).toBeTruthy();
  });

  it('does not leak the framework banner', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns the error envelope for an unknown route', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('authentication is required where it should be', () => {
  it.each([
    ['get', '/api/v1/users/me/saved'],
    ['get', '/api/v1/trips'],
    ['post', '/api/v1/bookings'],
    ['post', '/api/v1/payments/order'],
    ['get', '/api/v1/guides/me/dashboard'],
    ['get', '/api/v1/admin/dashboard'],
    ['post', '/api/v1/ai/discover'],
    ['get', '/api/v1/notifications'],
    ['post', '/api/v1/media/presign'],
  ])('%s %s rejects an anonymous caller', async (method, path) => {
    const res = await (method === 'get' ? request(app).get(path) : request(app).post(path).send({}));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('PORTAL SEPARATION', () => {
  it('refuses a traveller token on the guide portal', async () => {
    const res = await request(app)
      .get('/api/v1/guides/me/dashboard')
      .set('authorization', `Bearer ${traveller}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });

  it('refuses a traveller token on the admin portal', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('authorization', `Bearer ${traveller}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });

  it('refuses a guide token on the admin portal', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${guide}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });

  it('refuses an admin token on a traveller-only route', async () => {
    const res = await request(app).get('/api/v1/trips').set('authorization', `Bearer ${admin}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });

  it('refuses an admin token on the guide portal', async () => {
    const res = await request(app)
      .get('/api/v1/guides/me/places')
      .set('authorization', `Bearer ${admin}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });
});

describe('input validation happens before any handler runs', () => {
  it('rejects a booking with no slot id', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('authorization', `Bearer ${traveller}`)
      .send({ seats: 2 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a booking that tries to set its own price', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('authorization', `Bearer ${traveller}`)
      .send({ slotId: '65f1c2d3e4b5a60718293a4b', seats: 1, totalMinor: 1 });
    expect(res.status).toBe(422);
  });

  it('rejects an operator-injection attempt on a public search', async () => {
    const res = await request(app).get('/api/v1/discovery/search?$where=1');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('has no popularity sort option on search', async () => {
    const res = await request(app).get('/api/v1/discovery/search?sort=popular');
    expect(res.status).toBe(422);
  });
});

describe('provider status is reported honestly', () => {
  it('says which AI provider is answering', async () => {
    const res = await request(app).get('/api/v1/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.data.provider.provider).toBe('stub');
    expect(res.body.data.provider.degraded).toBe(true);
  });
});

describe('payments refuse to pretend', () => {
  it('reports the provider as unconfigured instead of faking an order', async () => {
    const res = await request(app)
      .post('/api/v1/payments/order')
      .set('authorization', `Bearer ${traveller}`)
      .send({ bookingId: '65f1c2d3e4b5a60718293a4b' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_NOT_CONFIGURED');
  });

  it('rejects a webhook with no signature', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ event: 'payment.captured', payload: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});

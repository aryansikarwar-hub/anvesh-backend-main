import { describe, expect, it, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { parseConfig } from '../../lib/config';
import { requestId } from './request-id';
import { mongoSanitize } from './sanitize';
import { validate } from './validate';
import { errorHandler } from './error-handler';
import { notFoundHandler } from './not-found';
import { requireAuth, requirePortal, requireRoles } from './auth';
import { configureRateLimiting, rateLimit } from './rate-limit';
import { TokenService } from '../../modules/auth/token.service';
import { sendOk } from '../envelope';
import { AppError } from '../api-error';

const SECRET = 'y'.repeat(40);
const config = parseConfig({
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: SECRET,
  TOTP_ENCRYPTION_KEY: SECRET,
});
const tokens = new TokenService(config.env);

function buildApp(mount: (app: Express) => void): Express {
  const app = express();
  app.use(requestId());
  app.use(express.json());
  app.use(mongoSanitize());
  mount(app);
  app.use(notFoundHandler());
  app.use(errorHandler());
  return app;
}

beforeAll(() => {
  configureRateLimiting(false);
});

describe('request id', () => {
  it('mints one when absent and echoes it back', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => sendOk(res, { ok: true })));
    const res = await request(app).get('/x');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.body.meta.requestId).toBe(res.headers['x-request-id']);
  });

  it('reuses a sane client-supplied id', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => sendOk(res, { ok: true })));
    const res = await request(app).get('/x').set('x-request-id', 'trace-abc-123');
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('ignores a hostile client-supplied id', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => sendOk(res, { ok: true })));
    const res = await request(app).get('/x').set('x-request-id', 'bad id with spaces');
    expect(res.headers['x-request-id']).not.toBe('bad id with spaces');
  });
});

describe('NoSQL injection guard', () => {
  const app = buildApp((a) => a.post('/x', (_req, res) => sendOk(res, { ok: true })));

  it('rejects an operator key in the body', async () => {
    const res = await request(app).post('/x').send({ email: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a dotted key nested in an array', async () => {
    const res = await request(app).post('/x').send({ items: [{ 'a.b': 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects an operator key in the query string', async () => {
    const res = await request(app).post('/x?$where=1').send({});
    expect(res.status).toBe(400);
  });

  it('lets a clean payload through', async () => {
    const res = await request(app).post('/x').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
  });
});

describe('validation', () => {
  const schema = z.strictObject({ name: z.string().min(2), age: z.number().int().min(0) });
  const app = buildApp((a) =>
    a.post('/x', validate({ body: schema }), (req, res) => sendOk(res, req.body)),
  );

  it('returns 422 with per-field detail', async () => {
    const res = await request(app).post('/x').send({ name: 'a', age: -1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields.name).toBeDefined();
    expect(res.body.error.details.fields.age).toBeDefined();
  });

  it('strips nothing and rejects unknown fields', async () => {
    const res = await request(app).post('/x').send({ name: 'abc', age: 3, role: 'ADMIN' });
    expect(res.status).toBe(422);
  });

  it('replaces the request body with the parsed value', async () => {
    const res = await request(app).post('/x').send({ name: 'abc', age: 3 });
    expect(res.body.data).toEqual({ name: 'abc', age: 3 });
  });
});

describe('authorization layers', () => {
  const travellerToken = tokens.signAccessToken({
    userId: '65f1c2d3e4b5a60718293a4b',
    role: 'TRAVELLER',
    portal: 'TRAVELLER',
    tokenVersion: 0,
  }).token;
  const guideToken = tokens.signAccessToken({
    userId: '65f1c2d3e4b5a60718293a4c',
    role: 'TOURIST_GUIDE',
    portal: 'TOURIST_GUIDE',
    tokenVersion: 0,
  }).token;

  const app = buildApp((a) => {
    a.get(
      '/guide-only',
      requireAuth(tokens),
      requirePortal('TOURIST_GUIDE'),
      requireRoles('TOURIST_GUIDE'),
      (_req, res) => sendOk(res, { ok: true }),
    );
    a.get('/any-signed-in', requireAuth(tokens), (_req, res) => sendOk(res, { ok: true }));
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/any-signed-in');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token with AUTH_TOKEN_INVALID', async () => {
    const res = await request(app).get('/any-signed-in').set('authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects a traveller token on a guide route with PORTAL_MISMATCH', async () => {
    const res = await request(app)
      .get('/guide-only')
      .set('authorization', `Bearer ${travellerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });

  it('accepts a guide token on a guide route', async () => {
    const res = await request(app).get('/guide-only').set('authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(200);
  });

  it('rejects a token signed with a different secret', async () => {
    const other = new TokenService({ ...config.env, JWT_ACCESS_SECRET: 'z'.repeat(40) });
    const forged = other.signAccessToken({
      userId: '65f1c2d3e4b5a60718293a4b',
      role: 'ADMIN',
      portal: 'ADMIN',
      tokenVersion: 0,
    }).token;
    const res = await request(app).get('/any-signed-in').set('authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('error envelope', () => {
  it('never leaks internal detail on an unexpected throw', async () => {
    const app = buildApp((a) =>
      a.get('/boom', () => {
        throw new Error('connection string mongodb://user:pa55@host failed');
      }),
    );
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('mongodb://');
    expect(res.body.error.details).toBeUndefined();
  });

  it('exposes deliberate AppError detail', async () => {
    const app = buildApp((a) =>
      a.get('/nope', () => {
        throw new AppError('SLOT_SOLD_OUT', { details: { seatsLeft: 0 } });
      }),
    );
    const res = await request(app).get('/nope');
    expect(res.status).toBe(409);
    expect(res.body.error.details.seatsLeft).toBe(0);
  });

  it('returns the envelope for an unmatched route', async () => {
    const app = buildApp(() => undefined);
    const res = await request(app).get('/missing');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.meta.requestId).toBeTruthy();
  });
});

describe('rate limiting', () => {
  it('blocks after the configured number of attempts', async () => {
    configureRateLimiting(true);
    const app = buildApp((a) =>
      a.post(
        '/limited',
        rateLimit({ name: `spec-${Date.now()}`, points: 2, durationSeconds: 60 }),
        (_req, res) => sendOk(res, { ok: true }),
      ),
    );
    expect((await request(app).post('/limited').send({})).status).toBe(200);
    expect((await request(app).post('/limited').send({})).status).toBe(200);
    const third = await request(app).post('/limited').send({});
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
    configureRateLimiting(false);
  });
});

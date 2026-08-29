import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserModel } from '../src/lib/database';
import {
  accessToken,
  bearer,
  createUser,
  resetDatabase,
  startHarness,
  stopHarness,
  TEST_PASSWORD,
  type Harness,
} from './harness';
import { createExperience, createSlot } from './fixtures';

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await stopHarness();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('registration and login', () => {
  it('registers a traveller, hashes the password and never returns it', async () => {
    const res = await request(harness.app).post('/api/v1/auth/register').send({
      email: 'aarav.integration@example.in',
      password: 'Str0ngPassword',
      displayName: 'Aarav',
      accountType: 'TRAVELLER',
      acceptTerms: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('aarav.integration@example.in');
    expect(JSON.stringify(res.body)).not.toContain('Str0ngPassword');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const stored = await UserModel.findOne({ email: 'aarav.integration@example.in' })
      .select('+passwordHash')
      .lean();
    expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('creates a guide profile when the account type is TOURIST_GUIDE', async () => {
    const res = await request(harness.app).post('/api/v1/auth/register').send({
      email: 'guide.integration@example.in',
      password: 'Str0ngPassword',
      displayName: 'Shreya',
      accountType: 'TOURIST_GUIDE',
      acceptTerms: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('TOURIST_GUIDE');
    expect(res.body.data.user.portals).toContain('TOURIST_GUIDE');
  });

  it('refuses a duplicate email', async () => {
    const body = {
      email: 'dupe@example.in',
      password: 'Str0ngPassword',
      displayName: 'Dupe',
      accountType: 'TRAVELLER',
      acceptTerms: true,
    };
    await request(harness.app).post('/api/v1/auth/register').send(body);
    const second = await request(harness.app).post('/api/v1/auth/register').send(body);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');
  });

  it('will not let a client choose its own role', async () => {
    const res = await request(harness.app).post('/api/v1/auth/register').send({
      email: 'sneaky@example.in',
      password: 'Str0ngPassword',
      displayName: 'Sneaky',
      accountType: 'TRAVELLER',
      acceptTerms: true,
      role: 'ADMIN',
    });
    expect(res.status).toBe(422);
  });

  it('signs in and returns a portal-scoped session', async () => {
    const user = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    const res = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD, portal: 'TRAVELLER' });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toContain('anvesh_rt');
    expect(res.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const user = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    const wrongPassword = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Wr0ngPassword', portal: 'TRAVELLER' });
    const unknownEmail = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.in', password: 'Wr0ngPassword', portal: 'TRAVELLER' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe(unknownEmail.body.error.code);
  });

  it('refuses a portal the account is not allowed on', async () => {
    const user = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    const res = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD, portal: 'TOURIST_GUIDE' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_NOT_ALLOWED');
  });

  it('never issues an admin session from the ordinary login route', async () => {
    const admin = await createUser({ role: 'ADMIN', portals: ['ADMIN'] });
    const res = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: TEST_PASSWORD, portal: 'ADMIN' });
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  it('blocks a suspended account', async () => {
    const user = await createUser({
      role: 'TRAVELLER',
      portals: ['TRAVELLER'],
      status: 'SUSPENDED',
    });
    const res = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD, portal: 'TRAVELLER' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
  });
});

describe('refresh token rotation', () => {
  async function login() {
    const user = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    const res = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD, portal: 'TRAVELLER' });
    return { user, refreshToken: res.body.data.tokens.refreshToken as string };
  }

  it('rotates the refresh token on every use', async () => {
    const { refreshToken } = await login();
    const first = await request(harness.app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.tokens.refreshToken).not.toBe(refreshToken);
  });

  it('DETECTS REUSE and revokes the whole family', async () => {
    const { refreshToken } = await login();
    const rotated = await request(harness.app).post('/api/v1/auth/refresh').send({ refreshToken });
    const newToken = rotated.body.data.tokens.refreshToken as string;

    // Replaying the original token is the signature of a stolen token.
    const replay = await request(harness.app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('AUTH_TOKEN_REUSED');

    // ...and the token issued from it is dead too.
    const afterRevoke = await request(harness.app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newToken });
    expect(afterRevoke.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await request(harness.app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'a'.repeat(43) });
    expect(res.status).toBe(401);
  });
});

describe('password reset invalidates sessions', () => {
  it('revokes every refresh token when the password changes', async () => {
    const user = await createUser({ role: 'TRAVELLER', portals: ['TRAVELLER'] });
    const login = await request(harness.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD, portal: 'TRAVELLER' });
    const refreshToken = login.body.data.tokens.refreshToken as string;

    const changed = await request(harness.app)
      .post('/api/v1/auth/change-password')
      .set(...bearer(accessToken(harness, user, 'TRAVELLER')))
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Different@2026' });
    expect(changed.status).toBe(200);

    const replay = await request(harness.app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });
});

describe('email verification gate', () => {
  it('refuses to book with an unverified email', async () => {
    const guideUser = await createUser({
      role: 'TOURIST_GUIDE',
      portals: ['TOURIST_GUIDE', 'TRAVELLER'],
      withGuideProfile: true,
    });
    const experience = await createExperience({ guideId: guideUser.guideId as string });
    const slot = await createSlot({
      experienceId: String(experience._id),
      guideId: guideUser.guideId as string,
      seatsTotal: 4,
    });

    const unverified = await createUser({
      role: 'TRAVELLER',
      portals: ['TRAVELLER'],
      verified: false,
    });

    const res = await request(harness.app)
      .post('/api/v1/bookings')
      .set(...bearer(accessToken(harness, unverified, 'TRAVELLER')))
      .send({ slotId: String(slot._id), seats: 1 });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
  });
});

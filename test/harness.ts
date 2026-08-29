import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { type Express } from 'express';
import { parseConfig, type AppConfig } from '../src/lib/config';
import {
  connectDatabase,
  disconnectDatabase,
  getConnection,
  hashPassword,
  UserModel,
  GuideProfileModel,
} from '../src/lib/database';
import { Types } from 'mongoose';
import { type Portal, type Role } from '../src/lib/types';
import { createApp } from '../src/app';
import { createContainer, type Container } from '../src/container';
import { createLogger } from '../src/common/logger';
import { configureRateLimiting } from '../src/common/middleware/rate-limit';
import { TokenService } from '../src/modules/auth/token.service';

const require_ = createRequire(__filename);
const SECRET = 'integration-test-secret-value-at-least-32-chars';

export const TEST_PASSWORD = 'Integration@2026';

export interface Harness {
  app: Express;
  container: Container;
  config: AppConfig;
  tokens: TokenService;
}

export function buildTestConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return parseConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/anvesh-integration',
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? 'anvesh-integration',
    JWT_ACCESS_SECRET: SECRET,
    JWT_REFRESH_SECRET: SECRET,
    TOTP_ENCRYPTION_KEY: SECRET,
    AI_PROVIDER: 'stub',
    RATE_LIMIT_ENABLED: 'false',
    EMAIL_PROVIDER: 'console',
    UPLOAD_DIR: join(__dirname, '..', '.tmp-uploads'),
    ...overrides,
  });
}

/**
 * Boots the real application against the in-memory replica set and applies the
 * real migrate-mongo migrations, so indexes and $jsonSchema validators are
 * exactly the ones production gets.
 */
export async function startHarness(overrides: NodeJS.ProcessEnv = {}): Promise<Harness> {
  createLogger('fatal', false);
  const config = buildTestConfig(overrides);

  await connectDatabase({
    uri: config.env.MONGODB_URI,
    dbName: config.env.MONGODB_DB_NAME,
    autoIndex: false,
  });
  await runMigrations();

  configureRateLimiting(false);
  const container = createContainer(config);
  return { app: createApp(container), container, config, tokens: new TokenService(config.env) };
}

export async function stopHarness(): Promise<void> {
  await disconnectDatabase();
}

/** Applies every migration in backend/migrations, in order. */
export async function runMigrations(): Promise<void> {
  const db = getConnection().db;
  if (!db) throw new Error('No database handle');
  const migrationsDir = join(__dirname, '..', 'migrations');
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.js')).sort();
  for (const file of files) {
    const migration = require_(join(migrationsDir, file)) as { up: (db: unknown) => Promise<void> };
    await migration.up(db);
  }
}

export async function resetDatabase(): Promise<void> {
  const db = getConnection().db;
  if (!db) return;
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    if (collection.name.startsWith('migrations_')) continue;
    await db.collection(collection.name).deleteMany({});
  }
}

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  portals: Portal[];
  guideId?: string;
}

let counter = 0;

export async function createUser(input: {
  role: Role;
  portals: Portal[];
  verified?: boolean;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  withGuideProfile?: boolean;
  verifiedGuide?: boolean;
}): Promise<TestUser> {
  counter += 1;
  const email = `test-${counter}-${Date.now()}@example.in`;
  const user = await UserModel.create({
    email,
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: input.role,
    portals: input.portals,
    status: input.status ?? 'ACTIVE',
    emailVerifiedAt: input.verified === false ? null : new Date(),
    profile: { displayName: `Test User ${counter}`, locale: 'en-IN' },
  });

  const result: TestUser = {
    id: String(user._id),
    email,
    role: input.role,
    portals: input.portals,
  };

  if (input.withGuideProfile) {
    const guide = await GuideProfileModel.create({
      userId: user._id,
      slug: `test-guide-${counter}-${Date.now()}`,
      displayName: `Test Guide ${counter}`,
      headline: 'Integration test guide',
      baseCity: 'Madikeri',
      baseState: 'Karnataka',
      verified: input.verifiedGuide ?? true,
      verifiedAt: new Date(),
    });
    result.guideId = String(guide._id);
  }

  return result;
}

export function accessToken(
  harness: Harness,
  user: TestUser,
  portal: Portal,
): string {
  return harness.tokens.signAccessToken({
    userId: user.id,
    role: user.role,
    portal,
    tokenVersion: 0,
  }).token;
}

export function bearer(token: string): [string, string] {
  return ['authorization', `Bearer ${token}`];
}

export const oid = () => new Types.ObjectId().toHexString();

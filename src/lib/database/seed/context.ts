import { Types } from 'mongoose';
import { deterministicObjectId, SEED_NAMESPACE } from '../../shared';
import { connectDatabase, disconnectDatabase } from '../connection';

export function seedId(key: string): Types.ObjectId {
  return new Types.ObjectId(deterministicObjectId(SEED_NAMESPACE, key));
}

export interface SeedContext {
  now: Date;
  log: (message: string) => void;
}

export function createContext(): SeedContext {
  return {
    // Fixed clock so re-running the seed does not churn timestamps.
    now: new Date('2026-03-01T04:30:00.000Z'),
    log: (message: string) => process.stdout.write(`  ${message}\n`),
  };
}

export interface SeedRunOptions {
  uri: string;
  dbName: string;
}

/** Refuses to touch a production database. */
export function assertSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'Refusing to seed with NODE_ENV=production. Seed data contains shared development passwords.',
    );
  }
}

export async function openSeedConnection(options: SeedRunOptions) {
  return connectDatabase({ uri: options.uri, dbName: options.dbName, autoIndex: false });
}

export async function closeSeedConnection(): Promise<void> {
  await disconnectDatabase();
}

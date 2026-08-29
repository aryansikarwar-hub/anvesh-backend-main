#!/usr/bin/env node
import { config as loadDotenv } from 'dotenv';
import { assertSeedAllowed, closeSeedConnection, openSeedConnection } from './context';
import { getConnection } from '../connection';

const PRESERVED = new Set(['migrations_changelog', 'migrations_lock']);

/**
 * Empties every application collection but keeps the migration changelog, so
 * `db:reset` does not force a full re-migration. Refuses to run in production.
 */
async function main(): Promise<void> {
  loadDotenv(process.env.DOTENV_PATH ? { path: process.env.DOTENV_PATH } : {});
  assertSeedAllowed(process.env.NODE_ENV);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required.');

  await openSeedConnection({ uri, dbName: process.env.MONGODB_DB_NAME ?? 'anvesh' });
  const db = getConnection().db;
  if (!db) throw new Error('No database handle');

  try {
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      if (PRESERVED.has(c.name)) continue;
      const { deletedCount } = await db.collection(c.name).deleteMany({});
      process.stdout.write(`  cleared ${c.name}: ${deletedCount}\n`);
    }
    process.stdout.write('Reset complete. Run `npm run db:seed` to repopulate.\n');
  } finally {
    await closeSeedConnection();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Reset failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

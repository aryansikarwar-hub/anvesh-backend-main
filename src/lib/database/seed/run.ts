#!/usr/bin/env node
import { config as loadDotenv } from 'dotenv';
import { assertSeedAllowed, closeSeedConnection, createContext, openSeedConnection } from './context';
import { seedCategories, seedDestinations } from './seeders/taxonomy';
import { seedPeople } from './seeders/people';
import { seedExperiences, seedPlaces, seedStories } from './seeders/content';
import { seedAvailability } from './seeders/commerce';
import { seedReviews } from './seeders/engagement';
import { seedRecommendationConfig } from './seeders/config';
import { recomputeDiscoveryScores } from './discovery-scores';

/**
 * Idempotent seed. Every document has a deterministic _id derived from a
 * namespace and a natural key, and every write is an upsert, so running this
 * twice produces exactly the same database as running it once.
 */
async function main(): Promise<void> {
  loadDotenv(process.env.DOTENV_PATH ? { path: process.env.DOTENV_PATH } : {});
  assertSeedAllowed(process.env.NODE_ENV);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required. Copy .env.example to .env first.');

  const ctx = createContext();
  process.stdout.write('Seeding Anvesh...\n');
  await openSeedConnection({ uri, dbName: process.env.MONGODB_DB_NAME ?? 'anvesh' });

  try {
    await seedCategories(ctx);
    await seedDestinations(ctx);
    const people = await seedPeople(ctx);
    await seedPlaces(ctx, people);
    await seedExperiences(ctx, people);
    await seedStories(ctx, people);
    await seedAvailability(ctx);
    await seedReviews(ctx, people);
    await seedRecommendationConfig(ctx);
    await recomputeDiscoveryScores(ctx);
    process.stdout.write('Seed complete.\n');
  } finally {
    await closeSeedConnection();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

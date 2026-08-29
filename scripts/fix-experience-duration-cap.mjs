#!/usr/bin/env node
/**
 * One-off patch: raises the `experiences.durationMin` validator ceiling from
 * 1440 (24h) to 43200 (30 days) directly on the connected database.
 *
 * Why this exists: migrations/20260101000500-schema-validators-core.js
 * already ran on this database with the old 1440 cap, and migrate-mongo
 * will not re-run a migration it has already recorded as applied. Multi-day
 * experiences in the seed data (treks, circuits) have a durationMin above
 * 1440 minutes, so seeding fails with "Document failed validation" until
 * the live validator is corrected. This script does that correction without
 * touching migrate-mongo's changelog — the migration file has also been
 * updated to match, so a fresh database created from scratch gets the right
 * cap automatically.
 *
 * Usage (from the backend/ folder, with MONGODB_URI in .env):
 *   node scripts/fix-experience-duration-cap.mjs
 */
import { config as loadDotenv } from 'dotenv';
import { MongoClient } from 'mongodb';

loadDotenv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Copy .env.example to .env first.');
  process.exit(1);
}
const dbName = process.env.MONGODB_DB_NAME || 'anvesh';

const geoPoint = {
  bsonType: 'object',
  required: ['type', 'coordinates'],
  properties: {
    type: { enum: ['Point'] },
    coordinates: {
      bsonType: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        { bsonType: 'double', minimum: -180, maximum: 180 },
        { bsonType: 'double', minimum: -90, maximum: 90 },
      ],
    },
  },
};

const money = { bsonType: ['int', 'long'], minimum: 0 };

const experiences = {
  bsonType: 'object',
  required: ['slug', 'title', 'guideId', 'guideSummary', 'basePriceMinor', 'maxSeats', 'status'],
  properties: {
    slug: { bsonType: 'string', maxLength: 120 },
    title: { bsonType: 'string', minLength: 3, maxLength: 140 },
    basePriceMinor: money,
    durationMin: { bsonType: ['int', 'long'], minimum: 15, maximum: 43200 },
    maxSeats: { bsonType: ['int', 'long'], minimum: 1, maximum: 60 },
    images: { bsonType: 'array', maxItems: 12 },
    inclusions: { bsonType: 'array', maxItems: 15 },
    exclusions: { bsonType: 'array', maxItems: 15 },
    cancellationPolicy: { enum: ['FLEXIBLE', 'MODERATE', 'STRICT'] },
    status: { enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] },
    meetingPoint: {
      bsonType: 'object',
      required: ['label', 'location'],
      properties: { location: geoPoint },
    },
  },
};

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    await db.command({
      collMod: 'experiences',
      validator: { $jsonSchema: experiences },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    console.log('experiences validator updated: durationMin max is now 43200 (30 days).');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Failed to update validator:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
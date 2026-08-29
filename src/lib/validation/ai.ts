import { z } from 'zod';
import { latitudeSchema, longitudeSchema, objectIdSchema } from './common';

export const aiDiscoverRequestSchema = z.strictObject({
  prompt: z.string().trim().min(4).max(500),
  lng: longitudeSchema.optional(),
  lat: latitudeSchema.optional(),
  radiusKm: z.number().min(1).max(500).default(150),
  limit: z.number().int().min(1).max(12).default(6),
});

export const aiItineraryRequestSchema = z
  .strictObject({
    destinationId: objectIdSchema.nullable().default(null),
    city: z.string().trim().max(120).optional(),
    days: z.number().int().min(1).max(14),
    travellers: z.number().int().min(1).max(20).default(2),
    interests: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    pace: z.enum(['RELAXED', 'BALANCED', 'PACKED']).default('BALANCED'),
    avoidCrowds: z.boolean().default(true),
    saveAsTrip: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.destinationId) || Boolean(v.city), {
    message: 'Provide a destination or a city',
    path: ['destinationId'],
  });

export const aiExplainRequestSchema = z.strictObject({
  placeId: objectIdSchema,
  question: z.string().trim().max(300).optional(),
});

/* ---------------------------------------------------------------------------
 * Structured OUTPUT schemas.
 *
 * Every LLM response is parsed with these before anything else happens, and the
 * ids inside are then checked against MongoDB. An id the database does not know
 * is a hallucination and the whole response is rejected with
 * AI_HALLUCINATED_REFERENCE — it is never shown to a user or persisted.
 * ------------------------------------------------------------------------- */

export const aiDiscoveryOutputSchema = z.strictObject({
  answer: z.string().trim().min(1).max(1200),
  placeIds: z.array(objectIdSchema).min(0).max(12),
  highlights: z
    .array(z.strictObject({ placeId: objectIdSchema, why: z.string().trim().min(1).max(300) }))
    .max(12),
  followUps: z.array(z.string().trim().min(1).max(120)).max(4),
});

export const aiItineraryActivityOutputSchema = z.strictObject({
  kind: z.enum(['PLACE', 'EXPERIENCE', 'NOTE']),
  placeId: objectIdSchema.nullish(),
  experienceId: objectIdSchema.nullish(),
  title: z.string().trim().min(1).max(160),
  note: z.string().trim().max(400).default(''),
  startTimeMin: z.number().int().min(0).max(1439).nullable().default(null),
  durationMin: z.number().int().min(0).max(1440).default(60),
});

export const aiItineraryOutputSchema = z.strictObject({
  title: z.string().trim().min(1).max(140),
  summary: z.string().trim().min(1).max(800),
  days: z
    .array(
      z.strictObject({
        dayNumber: z.number().int().min(1).max(14),
        title: z.string().trim().min(1).max(120),
        activities: z.array(aiItineraryActivityOutputSchema).min(1).max(12),
      }),
    )
    .min(1)
    .max(14),
});

export const aiExplainOutputSchema = z.strictObject({
  summary: z.string().trim().min(1).max(1200),
  bestTime: z.string().trim().max(200).default(''),
  gettingThere: z.string().trim().max(400).default(''),
  respectfulTravelTips: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
});

export type AiDiscoveryOutput = z.infer<typeof aiDiscoveryOutputSchema>;
export type AiItineraryOutput = z.infer<typeof aiItineraryOutputSchema>;
export type AiExplainOutput = z.infer<typeof aiExplainOutputSchema>;

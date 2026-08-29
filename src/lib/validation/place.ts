import { z } from 'zod';
import {
  addressSchema,
  boundedStringArray,
  contentStatusSchema,
  geoPointSchema,
  imageRefSchema,
  minorAmountSchema,
  objectIdSchema,
  ownershipSchema,
  slugSchema,
  unitIntervalSchema,
} from './common';

export const openingHourSchema = z
  .strictObject({
    day: z.number().int().min(0).max(6),
    opensMin: z.number().int().min(0).max(1440),
    closesMin: z.number().int().min(0).max(1440),
    closed: z.boolean().default(false),
  })
  .refine((v) => v.closed || v.closesMin > v.opensMin, {
    message: 'Closing time must be after opening time',
  });

export const placeDetailsSchema = z.strictObject({
  entryFeeMinor: minorAmountSchema.default(0),
  bestTimeMonths: z.array(z.number().int().min(1).max(12)).max(12).default([]),
  durationMin: z.number().int().min(0).max(2880).default(60),
  accessibility: boundedStringArray(12, 60).default([]),
  amenities: boundedStringArray(20, 60).default([]),
  tips: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
});

/**
 * Guide-authored signals. Note that `popularityScore` and `crowdLevel` are NOT
 * accepted from any client: popularity is computed from real interaction data,
 * otherwise a guide could game the ranking by declaring themselves obscure.
 */
export const placeSelfDeclaredSignalsSchema = z.strictObject({
  localOwnership: unitIntervalSchema.default(0.5),
  authenticityScore: unitIntervalSchema.default(0.5),
  uniquenessScore: unitIntervalSchema.default(0.5),
});

export const placeCreateSchema = z.strictObject({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10).max(300),
  description: z.string().trim().min(30).max(8000),
  categorySlugs: z.array(slugSchema).min(1).max(8),
  location: geoPointSchema,
  address: addressSchema,
  images: z.array(imageRefSchema).max(12).default([]),
  openingHours: z.array(openingHourSchema).max(7).default([]),
  details: placeDetailsSchema.prefault({}),
  ownership: ownershipSchema.default('UNKNOWN'),
  selfDeclared: placeSelfDeclaredSignalsSchema.prefault({}),
  destinationId: objectIdSchema.nullable().default(null),
});

export const placeUpdateSchema = placeCreateSchema.partial();

export const placeSubmitSchema = z.strictObject({
  note: z.string().trim().max(500).optional(),
});

export const placeModerationSchema = z.strictObject({
  status: contentStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

export const placeAdminSignalsSchema = z.strictObject({
  qualityScore: unitIntervalSchema.optional(),
  authenticityScore: unitIntervalSchema.optional(),
  localOwnership: unitIntervalSchema.optional(),
  uniquenessScore: unitIntervalSchema.optional(),
  crowdLevel: unitIntervalSchema.optional(),
  lastVerifiedAt: z.iso.datetime().optional(),
});

export const destinationCreateSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(10).max(300),
  description: z.string().trim().min(30).max(6000),
  heroImage: imageRefSchema.nullable().default(null),
  location: geoPointSchema,
  bestMonths: z.array(z.number().int().min(1).max(12)).max(12).default([]),
});

export const destinationUpdateSchema = destinationCreateSchema.partial();

export const categoryCreateSchema = z.strictObject({
  slug: slugSchema,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(''),
  icon: z.string().trim().min(1).max(60),
  parentSlug: slugSchema.nullable().default(null),
  sortOrder: z.number().int().min(0).max(999).default(100),
});

export type PlaceCreateInput = z.infer<typeof placeCreateSchema>;
export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>;
export type DestinationCreateInput = z.infer<typeof destinationCreateSchema>;

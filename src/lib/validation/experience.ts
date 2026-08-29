import { z } from 'zod';
import {
  addressSchema,
  boundedStringArray,
  contentStatusSchema,
  geoPointSchema,
  imageRefSchema,
  minorAmountSchema,
  objectIdSchema,
  slugSchema,
} from './common';

export const cancellationPolicySchema = z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']);

export const experienceCreateSchema = z.strictObject({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10).max(300),
  description: z.string().trim().min(30).max(8000),
  categorySlugs: z.array(slugSchema).min(1).max(8),
  images: z.array(imageRefSchema).max(12).default([]),
  durationMin: z.number().int().min(15).max(1440),
  maxSeats: z.number().int().min(1).max(60),
  basePriceMinor: minorAmountSchema,
  meetingPoint: z.strictObject({
    label: z.string().trim().min(3).max(160),
    location: geoPointSchema,
    address: addressSchema,
  }),
  languages: boundedStringArray(8, 20).default(['en']),
  inclusions: z.array(z.string().trim().min(1).max(160)).max(15).default([]),
  exclusions: z.array(z.string().trim().min(1).max(160)).max(15).default([]),
  cancellationPolicy: cancellationPolicySchema.default('MODERATE'),
  placeId: objectIdSchema.nullable().default(null),
});

export const experienceUpdateSchema = experienceCreateSchema.partial();

export const experienceModerationSchema = z.strictObject({
  status: contentStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>;

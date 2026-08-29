import { z } from 'zod';
import { REVIEW_TARGETS } from '../types';
import { objectIdSchema, paginationQuerySchema, unitIntervalSchema } from './common';

export const reviewCreateSchema = z.strictObject({
  targetType: z.enum(REVIEW_TARGETS),
  targetId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(20).max(4000),
  visitedAt: z.iso.date().nullable().default(null),
  /** How crowded it felt. Feeds the crowd penalty, so it is a first-class field. */
  crowdFelt: unitIntervalSchema.nullable().default(null),
  imageUrls: z.array(z.url().max(1000)).max(6).default([]),
});

export const reviewUpdateSchema = reviewCreateSchema
  .pick({ rating: true, title: true, body: true, crowdFelt: true, imageUrls: true })
  .partial();

export const reviewQuerySchema = paginationQuerySchema.extend({
  targetType: z.enum(REVIEW_TARGETS).optional(),
  targetId: objectIdSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['recent', 'rating_high', 'rating_low', 'helpful']).default('recent'),
});

export const reviewReportSchema = z.strictObject({
  reason: z.enum(['SPAM', 'OFFENSIVE', 'FAKE', 'OFF_TOPIC', 'PRIVACY', 'OTHER']),
  details: z.string().trim().max(600).default(''),
});

export const reviewModerationSchema = z.strictObject({
  status: z.enum(['PUBLISHED', 'HIDDEN', 'REMOVED']),
  note: z.string().trim().max(400).default(''),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

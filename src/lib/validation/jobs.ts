import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../types';
import { objectIdSchema } from './common';

/**
 * Job payload schemas.
 *
 * A queue is an untrusted boundary like any other, so the consumer validates
 * every payload with the same schema the producer used.
 */
export const emailJobSchema = z.strictObject({
  to: z.email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(200_000),
  text: z.string().min(1).max(50_000),
});

export const notificationJobSchema = z.strictObject({
  userId: objectIdSchema,
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(600),
  href: z.string().max(500).nullable().default(null),
});

export const bookingEmailJobSchema = z.strictObject({
  bookingId: objectIdSchema,
  kind: z.enum(['CONFIRMED', 'CANCELLED']),
  reason: z.string().max(300).default(''),
});

export const summarySyncJobSchema = z.strictObject({
  guideId: objectIdSchema,
});

export const analyticsEventJobSchema = z.strictObject({
  type: z.string().min(1).max(40),
  userId: objectIdSchema.nullable().default(null),
  placeId: objectIdSchema.nullable().default(null),
  experienceId: objectIdSchema.nullable().default(null),
  query: z.string().max(200).nullable().default(null),
  occurredAt: z.iso.datetime(),
});

export const recommendationJobSchema = z.strictObject({
  reason: z.enum(['NIGHTLY', 'CONFIG_CHANGED', 'MANUAL']).default('NIGHTLY'),
});

export const cleanupJobSchema = z.strictObject({
  task: z.enum(['EXPIRE_BOOKINGS', 'DRAIN_OUTBOX', 'PURGE_PENDING_MEDIA']),
});

export type EmailJob = z.infer<typeof emailJobSchema>;
export type NotificationJob = z.infer<typeof notificationJobSchema>;
export type BookingEmailJob = z.infer<typeof bookingEmailJobSchema>;
export type SummarySyncJob = z.infer<typeof summarySyncJobSchema>;
export type AnalyticsEventJob = z.infer<typeof analyticsEventJobSchema>;
export type RecommendationJob = z.infer<typeof recommendationJobSchema>;
export type CleanupJob = z.infer<typeof cleanupJobSchema>;

import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

/** Hard caps keep the embedded trip document bounded (docs/spec-conflicts.md C4). */
export const MAX_TRIP_DAYS = 30;
export const MAX_ACTIVITIES_PER_DAY = 20;

export const tripActivityInputSchema = z
  .strictObject({
    kind: z.enum(['PLACE', 'EXPERIENCE', 'NOTE']),
    placeId: objectIdSchema.optional(),
    experienceId: objectIdSchema.optional(),
    title: z.string().trim().min(1).max(160),
    note: z.string().trim().max(600).default(''),
    startTimeMin: z.number().int().min(0).max(1439).nullable().default(null),
    durationMin: z.number().int().min(0).max(1440).default(60),
  })
  .refine((v) => (v.kind === 'PLACE' ? Boolean(v.placeId) : true), {
    message: 'placeId is required for PLACE activities',
    path: ['placeId'],
  })
  .refine((v) => (v.kind === 'EXPERIENCE' ? Boolean(v.experienceId) : true), {
    message: 'experienceId is required for EXPERIENCE activities',
    path: ['experienceId'],
  });

export const tripCreateSchema = z.strictObject({
  title: z.string().trim().min(2).max(120),
  destinationId: objectIdSchema.nullable().default(null),
  startDate: z.iso.date().nullable().default(null),
  endDate: z.iso.date().nullable().default(null),
  travellers: z.number().int().min(1).max(30).default(1),
  notes: z.string().trim().max(2000).default(''),
});

export const tripUpdateSchema = tripCreateSchema.partial();

export const tripDayCreateSchema = z.strictObject({
  title: z.string().trim().min(1).max(120).default('Day'),
  date: z.iso.date().nullable().default(null),
});

export const tripDayUpdateSchema = tripDayCreateSchema.partial();

export const tripActivityReorderSchema = z.strictObject({
  /** Full ordered list of activity ids for the day. Partial lists are rejected. */
  activityIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_ACTIVITIES_PER_DAY),
});

export const tripMoveActivitySchema = z.strictObject({
  toDayId: z.string().min(1).max(64),
  toIndex: z.number().int().min(0).max(MAX_ACTIVITIES_PER_DAY - 1),
});

export const tripQuerySchema = paginationQuerySchema.extend({
  destinationId: objectIdSchema.optional(),
});

export type TripCreateInput = z.infer<typeof tripCreateSchema>;
export type TripActivityInput = z.infer<typeof tripActivityInputSchema>;

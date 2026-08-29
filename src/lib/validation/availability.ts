import { z } from 'zod';
import { minorAmountSchema, objectIdSchema, paginationQuerySchema } from './common';

export const slotCreateSchema = z
  .strictObject({
    experienceId: objectIdSchema,
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    seatsTotal: z.number().int().min(1).max(60),
    priceMinor: minorAmountSchema,
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

/** Generates a run of slots — bounded so one request cannot create thousands. */
export const slotBulkCreateSchema = z
  .strictObject({
    experienceId: objectIdSchema,
    fromDate: z.iso.date(),
    toDate: z.iso.date(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTimeMin: z.number().int().min(0).max(1439),
    durationMin: z.number().int().min(15).max(1440),
    seatsTotal: z.number().int().min(1).max(60),
    priceMinor: minorAmountSchema,
  })
  .refine((v) => new Date(v.toDate) >= new Date(v.fromDate), {
    message: 'toDate must not be before fromDate',
    path: ['toDate'],
  })
  .refine(
    (v) =>
      (new Date(v.toDate).getTime() - new Date(v.fromDate).getTime()) / 86_400_000 <= 180,
    { message: 'Generate at most 180 days of slots at a time', path: ['toDate'] },
  );

export const slotUpdateSchema = z.strictObject({
  seatsTotal: z.number().int().min(1).max(60).optional(),
  priceMinor: minorAmountSchema.optional(),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
});

export const slotQuerySchema = paginationQuerySchema.extend({
  experienceId: objectIdSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'CANCELLED']).optional(),
});

export const availabilityQuerySchema = z.strictObject({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type SlotCreateInput = z.infer<typeof slotCreateSchema>;
export type SlotBulkCreateInput = z.infer<typeof slotBulkCreateSchema>;

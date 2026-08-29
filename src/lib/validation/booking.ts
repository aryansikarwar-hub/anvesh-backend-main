import { z } from 'zod';
import { BOOKING_STATUSES } from '../types';
import { objectIdSchema, paginationQuerySchema } from './common';

/**
 * A booking request carries only what the traveller may choose. Prices, fees,
 * commission and the owning user are all resolved server-side from the slot.
 */
export const bookingCreateSchema = z.strictObject({
  slotId: objectIdSchema,
  seats: z.number().int().min(1).max(20),
  travellerNote: z.string().trim().max(500).default(''),
  contactPhone: z
    .string()
    .regex(/^(\+91)?[6-9][0-9]{9}$/, 'Enter a valid Indian mobile number')
    .optional(),
});

export const bookingCancelSchema = z.strictObject({
  reason: z.string().trim().min(3).max(300),
});

export const bookingQuerySchema = paginationQuerySchema.extend({
  status: z.enum(BOOKING_STATUSES).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  experienceId: objectIdSchema.optional(),
});

export const guideBookingActionSchema = z.strictObject({
  action: z.enum(['CANCEL', 'COMPLETE']),
  reason: z.string().trim().max(300).default(''),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

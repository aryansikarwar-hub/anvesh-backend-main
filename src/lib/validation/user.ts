import { z } from 'zod';
import { boundedStringArray, budgetBandSchema, objectIdSchema, unitIntervalSchema } from './common';

export const userProfileUpdateSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(600).optional(),
  avatarUrl: z.url().max(1000).optional(),
  phone: z
    .string()
    .regex(/^(\+91)?[6-9][0-9]{9}$/, 'Enter a valid Indian mobile number')
    .optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  locale: z.enum(['en-IN', 'hi-IN']).optional(),
});

export const userPreferencesSchema = z.strictObject({
  interests: boundedStringArray(20, 60),
  travelStyles: boundedStringArray(10, 40),
  budgetBand: budgetBandSchema,
  crowdTolerance: unitIntervalSchema,
  prefersLocalOwned: z.boolean(),
  dietary: boundedStringArray(10, 40),
  languages: boundedStringArray(10, 20),
  homeCity: z.string().trim().max(120).optional(),
});

export const userPreferencesUpdateSchema = userPreferencesSchema.partial();

export const savePlaceSchema = z.strictObject({
  placeId: objectIdSchema,
  collectionId: objectIdSchema.nullable().default(null),
});

export const collectionCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).default(''),
  isPublic: z.boolean().default(false),
});

export const collectionUpdateSchema = collectionCreateSchema.partial();

export const guideProfileUpdateSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().min(4).max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
  avatarUrl: z.url().max(1000).optional(),
  coverImageUrl: z.url().max(1000).optional(),
  languages: boundedStringArray(10, 20).optional(),
  specialities: boundedStringArray(10, 60).optional(),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  baseCity: z.string().trim().min(1).max(120).optional(),
  baseState: z.string().trim().min(1).max(120).optional(),
});

export const guidePayoutUpdateSchema = z.strictObject({
  accountHolderName: z.string().trim().min(2).max(120),
  accountNumber: z.string().regex(/^[0-9]{9,18}$/, 'Enter a valid account number'),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code'),
  bankName: z.string().trim().min(2).max(120),
  upiId: z
    .string()
    .regex(/^[\w.-]{2,64}@[a-zA-Z]{2,32}$/, 'Enter a valid UPI id')
    .optional(),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type GuideProfileUpdateInput = z.infer<typeof guideProfileUpdateSchema>;

import { z } from 'zod';
import { BUDGET_BANDS, CONTENT_STATUSES, OWNERSHIP_TYPES, PORTALS, ROLES } from '../types';

/** 24-character hex string, the wire format of a MongoDB ObjectId. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a 24-character hex id');

export const slugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase hyphenated slug');

export const portalSchema = z.enum(PORTALS);
export const roleSchema = z.enum(ROLES);
export const contentStatusSchema = z.enum(CONTENT_STATUSES);
export const ownershipSchema = z.enum(OWNERSHIP_TYPES);
export const budgetBandSchema = z.enum(BUDGET_BANDS);

/** Money is always a non-negative integer number of minor units. */
export const minorAmountSchema = z
  .number()
  .int('Amount must be an integer in minor units (paise)')
  .min(0)
  .max(100_000_000_00);

export const unitIntervalSchema = z.number().min(0).max(1);

export const longitudeSchema = z.number().min(-180).max(180);
export const latitudeSchema = z.number().min(-90).max(90);

/** GeoJSON point. Coordinates are [longitude, latitude] in that order. */
export const geoPointSchema = z.strictObject({
  type: z.literal('Point'),
  coordinates: z.tuple([longitudeSchema, latitudeSchema]),
});

export const addressSchema = z.strictObject({
  line1: z.string().trim().max(200).optional(),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().max(120).optional(),
  state: z.string().trim().min(1).max(120),
  pincode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, 'Must be a valid 6-digit Indian PIN code')
    .optional(),
  country: z.string().trim().length(2).default('IN'),
});

export const boundingBoxSchema = z
  .strictObject({
    west: longitudeSchema,
    south: latitudeSchema,
    east: longitudeSchema,
    north: latitudeSchema,
  })
  .refine((b) => b.west < b.east && b.south < b.north, {
    message: 'Bounding box must have west < east and south < north',
  });

export const paginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.strictObject({ id: objectIdSchema });
export const slugParamSchema = z.strictObject({ slug: slugSchema });

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export const isoDateSchema = z.iso.datetime({ offset: true }).or(z.iso.datetime());
export const isoDateOnlySchema = z.iso.date();

export const imageRefSchema = z.strictObject({
  key: z.string().min(1).max(300),
  url: z.url().max(1000),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  alt: z.string().trim().min(1).max(200),
  credit: z.string().trim().max(200).optional(),
});

export const boundedStringArray = (max: number, itemMax = 60) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max);

export type ObjectIdString = z.infer<typeof objectIdSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

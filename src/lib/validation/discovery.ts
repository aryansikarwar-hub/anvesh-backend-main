import { z } from 'zod';
import {
  boundingBoxSchema,
  latitudeSchema,
  longitudeSchema,
  objectIdSchema,
  ownershipSchema,
  paginationQuerySchema,
  slugSchema,
  unitIntervalSchema,
} from './common';

const csvSlugs = z
  .string()
  .max(300)
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(slugSchema).max(8));

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(160).optional(),
  categories: csvSlugs.optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  destinationId: objectIdSchema.optional(),
  lng: z.coerce.number().pipe(longitudeSchema).optional(),
  lat: z.coerce.number().pipe(latitudeSchema).optional(),
  radiusKm: z.coerce.number().min(0.5).max(500).default(50),
  ownership: ownershipSchema.optional(),
  maxCrowd: z.coerce.number().pipe(unitIntervalSchema).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxEntryFeeMinor: z.coerce.number().int().min(0).optional(),
  /**
   * Sort options deliberately exclude "most popular". Popularity is a penalty,
   * so there is no way to ask the API to rank by it.
   */
  sort: z.enum(['recommended', 'nearest', 'rating', 'newest', 'quietest']).default('recommended'),
});

export const nearbyQuerySchema = z.strictObject({
  lng: z.coerce.number().pipe(longitudeSchema),
  lat: z.coerce.number().pipe(latitudeSchema),
  radiusKm: z.coerce.number().min(0.2).max(200).default(10),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  excludePlaceId: objectIdSchema.optional(),
  categories: csvSlugs.optional(),
});

export const mapQuerySchema = z.strictObject({
  west: z.coerce.number().pipe(longitudeSchema),
  south: z.coerce.number().pipe(latitudeSchema),
  east: z.coerce.number().pipe(longitudeSchema),
  north: z.coerce.number().pipe(latitudeSchema),
  limit: z.coerce.number().int().min(1).max(300).default(200),
  categories: csvSlugs.optional(),
  maxCrowd: z.coerce.number().pipe(unitIntervalSchema).optional(),
});

export const feedQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(40).default(12),
  lng: z.coerce.number().pipe(longitudeSchema).optional(),
  lat: z.coerce.number().pipe(latitudeSchema).optional(),
});

export const hiddenGemsQuerySchema = feedQuerySchema.extend({
  state: z.string().trim().max(120).optional(),
});

export { boundingBoxSchema };
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;
export type MapQuery = z.infer<typeof mapQuerySchema>;

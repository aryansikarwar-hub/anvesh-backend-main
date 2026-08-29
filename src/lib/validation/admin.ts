import { z } from 'zod';
import { REPORT_STATUSES, ROLES, USER_STATUSES } from '../types';
import { objectIdSchema, paginationQuerySchema, unitIntervalSchema } from './common';

export const adminUserQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(160).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const adminUserUpdateSchema = z.strictObject({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
  note: z.string().trim().max(400).optional(),
});

export const adminGuideVerifySchema = z.strictObject({
  verified: z.boolean(),
  note: z.string().trim().max(400).default(''),
});

export const adminReportUpdateSchema = z.strictObject({
  status: z.enum(REPORT_STATUSES),
  resolutionNote: z.string().trim().max(600).default(''),
});

export const auditQuerySchema = paginationQuerySchema.extend({
  actorId: objectIdSchema.optional(),
  action: z.string().trim().max(80).optional(),
  targetType: z.string().trim().max(60).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

const weightSchema = z.number().min(0).max(5);

export const recommendationWeightsSchema = z.strictObject({
  relevance: weightSchema,
  preferenceMatch: weightSchema,
  quality: weightSchema,
  authenticity: weightSchema,
  localOwnership: weightSchema,
  freshness: weightSchema,
  uniqueness: weightSchema,
  /** Must stay strictly positive: popularity may never become a boost. */
  popularityPenalty: z.number().min(0.05).max(5),
  crowdPenalty: z.number().min(0.05).max(5),
});

export const recommendationParamsSchema = z.strictObject({
  freshnessHalfLifeDays: z.number().min(1).max(3650),
  distanceDecayKm: z.number().min(1).max(1000),
  maxCandidates: z.number().int().min(20).max(2000),
  minQuality: unitIntervalSchema,
  hiddenGemPopularityMax: unitIntervalSchema,
  hiddenGemMinQuality: unitIntervalSchema,
});

export const recommendationConfigUpdateSchema = z.strictObject({
  name: z.string().trim().min(2).max(80).optional(),
  weights: recommendationWeightsSchema.optional(),
  params: recommendationParamsSchema.optional(),
});

export const adminAnalyticsQuerySchema = z.strictObject({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});

export type RecommendationConfigUpdateInput = z.infer<typeof recommendationConfigUpdateSchema>;

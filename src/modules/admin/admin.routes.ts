import { Router } from 'express';
import { z } from 'zod';
import {
  adminAnalyticsQuerySchema,
  adminGuideVerifySchema,
  adminReportUpdateSchema,
  adminUserQuerySchema,
  adminUserUpdateSchema,
  auditQuerySchema,
  contentStatusSchema,
  experienceModerationSchema,
  idParamSchema,
  paginationQuerySchema,
  placeModerationSchema,
  recommendationConfigUpdateSchema,
  refundCreateSchema,
  reviewModerationSchema,
  storyModerationSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePortal, requireRoles } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type AdminController } from './admin.controller';
import { type TokenService } from '../auth/token.service';

const contentListQuery = paginationQuerySchema.extend({
  status: contentStatusSchema.optional(),
});

const reviewListQuery = paginationQuerySchema.extend({
  status: z.enum(['PUBLISHED', 'HIDDEN', 'REMOVED']).optional(),
  reportedOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const commerceListQuery = paginationQuerySchema.extend({
  status: z.string().max(40).optional(),
});

const guideListQuery = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  verified: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const reportListQuery = paginationQuerySchema.extend({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
});

/**
 * Admin API.
 *
 * Three checks stack on every route: the ADMIN portal, an admin role, and — for
 * the destructive operations — the narrower ADMIN/SUPER_ADMIN roles. A
 * MODERATOR can moderate content but cannot change users, refunds or ranking.
 */
export function adminRoutes(controller: AdminController, tokens: TokenService): Router {
  const router = Router();
  router.use(
    requireAuth(tokens),
    requirePortal('ADMIN'),
    requireRoles('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
  );

  router.get('/dashboard', controller.dashboard);
  router.get('/analytics', validate({ query: adminAnalyticsQuerySchema }), controller.analyticsTimeseries);
  router.get('/ai/monitoring', controller.aiMonitoring);
  router.get('/system/health', controller.systemHealth);
  router.get('/audit-logs', validate({ query: auditQuerySchema }), controller.listAudit);

  // --- moderation (moderators allowed) -------------------------------------
  router.get('/places', validate({ query: contentListQuery }), controller.listPlaces);
  router.post(
    '/places/:id/moderate',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: placeModerationSchema }),
    controller.moderatePlace,
  );
  router.get('/experiences', validate({ query: contentListQuery }), controller.listExperiences);
  router.post(
    '/experiences/:id/moderate',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: experienceModerationSchema }),
    controller.moderateExperience,
  );
  router.get('/stories', validate({ query: contentListQuery }), controller.listStories);
  router.post(
    '/stories/:id/moderate',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: storyModerationSchema }),
    controller.moderateStory,
  );
  router.get('/reviews', validate({ query: reviewListQuery }), controller.listReviews);
  router.post(
    '/reviews/:id/moderate',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: reviewModerationSchema }),
    controller.moderateReview,
  );
  router.get('/reports', validate({ query: reportListQuery }), controller.listReports);
  router.post(
    '/reports/:id/resolve',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: adminReportUpdateSchema }),
    controller.resolveReport,
  );

  // --- admin-only ----------------------------------------------------------
  const adminOnly = requireRoles('ADMIN', 'SUPER_ADMIN');

  router.get('/users', adminOnly, validate({ query: adminUserQuerySchema }), controller.listUsers);
  router.get('/users/:id', adminOnly, validate({ params: idParamSchema }), controller.getUser);
  router.patch(
    '/users/:id',
    adminOnly,
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: adminUserUpdateSchema }),
    controller.updateUser,
  );

  router.get('/guides', adminOnly, validate({ query: guideListQuery }), controller.listGuides);
  router.post(
    '/guides/:id/verify',
    adminOnly,
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: adminGuideVerifySchema }),
    controller.verifyGuide,
  );

  router.get('/bookings', adminOnly, validate({ query: commerceListQuery }), controller.listBookings);
  router.get('/payments', adminOnly, validate({ query: commerceListQuery }), controller.listPayments);
  router.post(
    '/refunds',
    adminOnly,
    rateLimit(RATE_LIMITS.payment),
    validate({ body: refundCreateSchema }),
    controller.refund,
  );

  router.get('/recommendation-config', adminOnly, controller.getRecommendationConfig);
  router.put(
    '/recommendation-config',
    adminOnly,
    rateLimit(RATE_LIMITS.write),
    validate({ body: recommendationConfigUpdateSchema }),
    controller.updateRecommendationConfig,
  );

  return router;
}

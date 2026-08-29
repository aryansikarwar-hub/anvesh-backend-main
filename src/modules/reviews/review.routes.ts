import { Router } from 'express';
import { z } from 'zod';
import {
  idParamSchema,
  objectIdSchema,
  paginationQuerySchema,
  reviewCreateSchema,
  reviewReportSchema,
  reviewUpdateSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth, requireAuth, requirePortal } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type ReviewController } from './review.controller';
import { type TokenService } from '../auth/token.service';

/** The public list always names a target; there is no "all reviews" feed. */
const publicReviewQuerySchema = paginationQuerySchema.extend({
  targetType: z.enum(['PLACE', 'EXPERIENCE']),
  targetId: objectIdSchema,
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['recent', 'rating_high', 'rating_low', 'helpful']).default('recent'),
});

export function reviewRoutes(controller: ReviewController, tokens: TokenService): Router {
  const router = Router();

  // Reading reviews is public.
  router.get(
    '/',
    optionalAuth(tokens),
    rateLimit(RATE_LIMITS.discovery),
    validate({ query: publicReviewQuerySchema }),
    controller.list,
  );

  router.use(requireAuth(tokens), requirePortal('TRAVELLER'));

  router.get('/mine', validate({ query: paginationQuerySchema }), controller.listMine);

  router.post(
    '/',
    rateLimit(RATE_LIMITS.review),
    validate({ body: reviewCreateSchema }),
    controller.create,
  );

  router.patch(
    '/:id',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: reviewUpdateSchema }),
    controller.update,
  );

  router.delete('/:id', validate({ params: idParamSchema }), controller.remove);

  router.post(
    '/:id/report',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: reviewReportSchema }),
    controller.report,
  );

  return router;
}

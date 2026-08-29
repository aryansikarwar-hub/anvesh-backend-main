import { Router } from 'express';
import { contentStatusSchema, paginationQuerySchema, slugParamSchema } from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type PlaceController } from './place.controller';
import { type TokenService } from '../auth/token.service';

export const guidePlaceListQuerySchema = paginationQuerySchema.extend({
  status: contentStatusSchema.optional(),
});

/** Public place routes. Only PUBLISHED documents are reachable here. */
export function placeRoutes(controller: PlaceController, tokens: TokenService): Router {
  const router = Router();
  router.get(
    '/:slug',
    optionalAuth(tokens),
    rateLimit(RATE_LIMITS.discovery),
    validate({ params: slugParamSchema }),
    controller.getBySlug,
  );
  return router;
}

import { Router } from 'express';
import { z } from 'zod';
import {
  availabilityQuerySchema,
  idParamSchema,
  objectIdSchema,
  paginationQuerySchema,
  slugParamSchema,
  slugSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type ExperienceController } from './experience.controller';
import { type TokenService } from '../auth/token.service';

const listQuerySchema = paginationQuerySchema.extend({
  guideSlug: slugSchema.optional(),
  placeId: objectIdSchema.optional(),
});

const availabilityParamsSchema = z.strictObject({ id: objectIdSchema });

export function experienceRoutes(
  controller: ExperienceController,
  tokens: TokenService,
): Router {
  const router = Router();
  router.use(optionalAuth(tokens), rateLimit(RATE_LIMITS.discovery));

  router.get('/', validate({ query: listQuerySchema }), controller.list);
  router.get(
    '/:id/availability',
    validate({ params: availabilityParamsSchema, query: availabilityQuerySchema }),
    controller.listAvailability,
  );
  router.get('/:slug', validate({ params: slugParamSchema }), controller.getBySlug);

  return router;
}

export { idParamSchema };

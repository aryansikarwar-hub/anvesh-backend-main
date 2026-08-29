import { Router } from 'express';
import { slugParamSchema, storyListQuerySchema } from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type StoryController } from './story.controller';
import { type TokenService } from '../auth/token.service';

/** Public story routes. Only PUBLISHED documents are reachable here. */
export function storyRoutes(controller: StoryController, tokens: TokenService): Router {
  const router = Router();

  router.get(
    '/',
    optionalAuth(tokens),
    rateLimit(RATE_LIMITS.discovery),
    validate({ query: storyListQuerySchema }),
    controller.list,
  );

  router.get(
    '/:slug',
    optionalAuth(tokens),
    rateLimit(RATE_LIMITS.discovery),
    validate({ params: slugParamSchema }),
    controller.getBySlug,
  );

  return router;
}

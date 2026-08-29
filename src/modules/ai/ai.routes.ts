import { Router } from 'express';
import { aiDiscoverRequestSchema, aiItineraryRequestSchema } from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth, requireAuth, requirePortal } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type AiController } from './ai.controller';
import { type TokenService } from '../auth/token.service';

export function aiRoutes(controller: AiController, tokens: TokenService): Router {
  const router = Router();

  router.get('/status', optionalAuth(tokens), controller.status);

  router.use(requireAuth(tokens), requirePortal('TRAVELLER'), rateLimit(RATE_LIMITS.ai));

  router.post('/discover', validate({ body: aiDiscoverRequestSchema }), controller.discover);
  router.post('/itinerary', validate({ body: aiItineraryRequestSchema }), controller.itinerary);

  return router;
}

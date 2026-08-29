import { Router } from 'express';
import {
  feedQuerySchema,
  hiddenGemsQuerySchema,
  mapQuerySchema,
  nearbyQuerySchema,
  searchQuerySchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type DiscoveryController } from './discovery.controller';
import { type TokenService } from '../auth/token.service';

/**
 * Discovery is public. `optionalAuth` upgrades an anonymous request to a
 * personalised one when a valid token happens to be present, and never rejects.
 */
export function discoveryRoutes(controller: DiscoveryController, tokens: TokenService): Router {
  const router = Router();
  router.use(optionalAuth(tokens), rateLimit(RATE_LIMITS.discovery));

  router.get('/search', validate({ query: searchQuerySchema }), controller.search);
  router.get('/nearby', validate({ query: nearbyQuerySchema }), controller.nearby);
  router.get('/map', validate({ query: mapQuerySchema }), controller.map);
  router.get('/feed', validate({ query: feedQuerySchema }), controller.feed);
  router.get('/hidden-gems', validate({ query: hiddenGemsQuerySchema }), controller.hiddenGems);

  return router;
}

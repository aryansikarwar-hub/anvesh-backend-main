import { Router } from 'express';
import { slugParamSchema } from '../../lib/validation';
import { sendOk } from '../../common/envelope';
import { validate, params } from '../../common/middleware/validate';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type TaxonomyService } from './taxonomy.service';

export function categoryRoutes(service: TaxonomyService): Router {
  const router = Router();
  router.get('/', rateLimit(RATE_LIMITS.discovery), async (_req, res) => {
    sendOk(res, { categories: await service.listCategories() });
  });
  return router;
}

export function destinationRoutes(service: TaxonomyService): Router {
  const router = Router();
  router.use(rateLimit(RATE_LIMITS.discovery));

  router.get('/', async (_req, res) => {
    sendOk(res, { destinations: await service.listDestinations() });
  });

  router.get('/:slug', validate({ params: slugParamSchema }), async (req, res) => {
    const { slug } = params<{ slug: string }>(req);
    sendOk(res, { destination: await service.getDestinationBySlug(slug) });
  });

  return router;
}

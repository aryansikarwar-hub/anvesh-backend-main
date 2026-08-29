import { Router } from 'express';
import { z } from 'zod';
import {
  idParamSchema,
  objectIdSchema,
  tripActivityInputSchema,
  tripActivityReorderSchema,
  tripCreateSchema,
  tripDayCreateSchema,
  tripDayUpdateSchema,
  tripQuerySchema,
  tripUpdateSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePortal } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type TripController } from './trip.controller';
import { type TokenService } from '../auth/token.service';

const dayParamsSchema = z.strictObject({
  id: objectIdSchema,
  dayId: objectIdSchema,
});

const activityParamsSchema = dayParamsSchema.extend({ activityId: objectIdSchema });

export function tripRoutes(controller: TripController, tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens), requirePortal('TRAVELLER'), rateLimit(RATE_LIMITS.write));

  router.get('/', validate({ query: tripQuerySchema }), controller.list);
  router.post('/', validate({ body: tripCreateSchema }), controller.create);
  router.get('/:id', validate({ params: idParamSchema }), controller.get);
  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: tripUpdateSchema }),
    controller.update,
  );
  router.delete('/:id', validate({ params: idParamSchema }), controller.remove);

  router.post(
    '/:id/days',
    validate({ params: idParamSchema, body: tripDayCreateSchema }),
    controller.addDay,
  );
  router.patch(
    '/:id/days/:dayId',
    validate({ params: dayParamsSchema, body: tripDayUpdateSchema }),
    controller.updateDay,
  );
  router.delete('/:id/days/:dayId', validate({ params: dayParamsSchema }), controller.removeDay);

  router.post(
    '/:id/days/:dayId/activities',
    validate({ params: dayParamsSchema, body: tripActivityInputSchema }),
    controller.addActivity,
  );
  router.delete(
    '/:id/days/:dayId/activities/:activityId',
    validate({ params: activityParamsSchema }),
    controller.removeActivity,
  );
  router.put(
    '/:id/days/:dayId/order',
    validate({ params: dayParamsSchema, body: tripActivityReorderSchema }),
    controller.reorder,
  );

  return router;
}

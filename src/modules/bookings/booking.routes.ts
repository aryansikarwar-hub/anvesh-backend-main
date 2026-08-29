import { Router } from 'express';
import { bookingCancelSchema, bookingCreateSchema, bookingQuerySchema, idParamSchema } from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePortal, requireRoles } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type BookingController } from './booking.controller';
import { type TokenService } from '../auth/token.service';

/** Traveller-facing booking routes. Guides manage bookings under /guides/me. */
export function bookingRoutes(controller: BookingController, tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens), requirePortal('TRAVELLER'), requireRoles('TRAVELLER', 'TOURIST_GUIDE'));

  router.post(
    '/',
    rateLimit(RATE_LIMITS.booking),
    validate({ body: bookingCreateSchema }),
    controller.create,
  );

  router.get('/', validate({ query: bookingQuerySchema }), controller.list);
  router.get('/:id', validate({ params: idParamSchema }), controller.get);

  router.post(
    '/:id/cancel',
    rateLimit(RATE_LIMITS.booking),
    validate({ params: idParamSchema, body: bookingCancelSchema }),
    controller.cancel,
  );

  return router;
}

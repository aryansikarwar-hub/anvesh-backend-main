import { Router } from 'express';
import { createOrderSchema, idParamSchema, verifyPaymentSchema } from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePortal } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type PaymentController } from './payment.controller';
import { type TokenService } from '../auth/token.service';

export function paymentRoutes(controller: PaymentController, tokens: TokenService): Router {
  const router = Router();

  // The webhook is mounted before the auth middleware: Razorpay has no token,
  // it proves itself with an HMAC over the raw body instead.
  router.post('/webhook', controller.webhook);

  router.use(requireAuth(tokens), requirePortal('TRAVELLER'), rateLimit(RATE_LIMITS.payment));

  router.post('/order', validate({ body: createOrderSchema }), controller.createOrder);
  router.post('/verify', validate({ body: verifyPaymentSchema }), controller.verify);
  router.get(
    '/by-booking/:id',
    validate({ params: idParamSchema }),
    controller.getByBooking,
  );

  return router;
}

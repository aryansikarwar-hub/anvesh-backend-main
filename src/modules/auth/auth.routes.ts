import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type AuthController } from './auth.controller';
import { type TokenService } from './token.service';

export function authRoutes(controller: AuthController, tokens: TokenService): Router {
  const router = Router();

  router.post(
    '/register',
    rateLimit(RATE_LIMITS.register),
    validate({ body: registerSchema }),
    controller.register,
  );

  router.post(
    '/login',
    rateLimit(RATE_LIMITS.login),
    validate({ body: loginSchema }),
    controller.login,
  );

  router.post(
    '/refresh',
    rateLimit(RATE_LIMITS.refresh),
    validate({ body: refreshSchema }),
    controller.refresh,
  );

  router.post(
    '/logout',
    requireAuth(tokens),
    validate({ body: logoutSchema }),
    controller.logout,
  );

  router.get('/me', requireAuth(tokens), controller.me);

  router.post('/verify-email', validate({ body: verifyEmailSchema }), controller.verifyEmail);

  router.post(
    '/resend-verification',
    rateLimit(RATE_LIMITS.passwordReset),
    validate({ body: resendVerificationSchema }),
    controller.resendVerification,
  );

  router.post(
    '/forgot-password',
    rateLimit(RATE_LIMITS.passwordReset),
    validate({ body: forgotPasswordSchema }),
    controller.forgotPassword,
  );

  router.post(
    '/reset-password',
    rateLimit(RATE_LIMITS.passwordReset),
    validate({ body: resetPasswordSchema }),
    controller.resetPassword,
  );

  router.post(
    '/change-password',
    requireAuth(tokens),
    validate({ body: changePasswordSchema }),
    controller.changePassword,
  );

  return router;
}

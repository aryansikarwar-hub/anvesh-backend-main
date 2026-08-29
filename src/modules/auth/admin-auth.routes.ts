import { Router } from 'express';
import {
  adminInviteAcceptSchema,
  adminInviteCreateSchema,
  adminLoginSchema,
  adminTotpSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePortal, requireRoles } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type AdminAuthController } from './admin-auth.controller';
import { type TokenService } from './token.service';

export function adminAuthRoutes(
  controller: AdminAuthController,
  tokens: TokenService,
): Router {
  const router = Router();

  router.post(
    '/login',
    rateLimit(RATE_LIMITS.login),
    validate({ body: adminLoginSchema }),
    controller.login,
  );

  router.post(
    '/totp',
    rateLimit(RATE_LIMITS.totp),
    validate({ body: adminTotpSchema }),
    controller.totp,
  );

  // Invites can only be created by a signed-in admin on the admin portal.
  router.post(
    '/invites',
    requireAuth(tokens),
    requirePortal('ADMIN'),
    requireRoles('ADMIN', 'SUPER_ADMIN'),
    validate({ body: adminInviteCreateSchema }),
    controller.createInvite,
  );

  router.post(
    '/invites/accept',
    rateLimit(RATE_LIMITS.register),
    validate({ body: adminInviteAcceptSchema }),
    controller.acceptInvite,
  );

  return router;
}

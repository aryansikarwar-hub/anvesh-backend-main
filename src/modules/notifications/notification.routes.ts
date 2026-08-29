import { Router } from 'express';
import { z } from 'zod';
import { idParamSchema, paginationQuerySchema } from '../../lib/validation';
import { sendOk } from '../../common/envelope';
import { params, query, validate } from '../../common/middleware/validate';
import { principal, requireAuth, requirePortal } from '../../common/middleware/auth';
import { type NotificationService } from './notification.service';
import { type TokenService } from '../auth/token.service';

const listQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export function notificationRoutes(
  service: NotificationService,
  tokens: TokenService,
): Router {
  const router = Router();
  router.use(requireAuth(tokens), requirePortal('TRAVELLER', 'TOURIST_GUIDE', 'ADMIN'));

  router.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    sendOk(res, await service.list(principal(req).userId, query(req)));
  });

  router.post('/read-all', async (req, res) => {
    sendOk(res, { marked: await service.markAllRead(principal(req).userId) });
  });

  router.post('/:id/read', validate({ params: idParamSchema }), async (req, res) => {
    await service.markRead(principal(req).userId, params<{ id: string }>(req).id);
    sendOk(res, { read: true });
  });

  return router;
}

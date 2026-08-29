import { Router } from 'express';
import { z } from 'zod';
import {
  collectionCreateSchema,
  collectionUpdateSchema,
  idParamSchema,
  objectIdSchema,
  paginationQuerySchema,
  savePlaceSchema,
  userPreferencesUpdateSchema,
  userProfileUpdateSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePortal } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type UserController } from './user.controller';
import { type TokenService } from '../auth/token.service';

const savedQuerySchema = paginationQuerySchema.extend({
  collectionId: objectIdSchema.optional(),
});

const placeIdParamSchema = z.strictObject({ id: objectIdSchema });

/** Everything under /users/me is scoped to the token holder. */
export function userRoutes(controller: UserController, tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens), requirePortal('TRAVELLER', 'TOURIST_GUIDE'));

  router.patch(
    '/me',
    rateLimit(RATE_LIMITS.write),
    validate({ body: userProfileUpdateSchema }),
    controller.updateProfile,
  );

  router.patch(
    '/me/preferences',
    rateLimit(RATE_LIMITS.write),
    validate({ body: userPreferencesUpdateSchema }),
    controller.updatePreferences,
  );

  router.get('/me/saved', validate({ query: savedQuerySchema }), controller.listSaved);

  router.post(
    '/me/saved',
    rateLimit(RATE_LIMITS.write),
    validate({ body: savePlaceSchema }),
    controller.savePlace,
  );

  router.delete(
    '/me/saved/:id',
    validate({ params: placeIdParamSchema }),
    controller.unsavePlace,
  );

  router.get('/me/collections', controller.listCollections);

  router.post(
    '/me/collections',
    rateLimit(RATE_LIMITS.write),
    validate({ body: collectionCreateSchema }),
    controller.createCollection,
  );

  router.patch(
    '/me/collections/:id',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: collectionUpdateSchema }),
    controller.updateCollection,
  );

  router.delete(
    '/me/collections/:id',
    validate({ params: idParamSchema }),
    controller.deleteCollection,
  );

  return router;
}

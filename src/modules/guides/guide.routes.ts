import { Router } from 'express';
import {
  bookingQuerySchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  guideBookingActionSchema,
  guidePayoutUpdateSchema,
  guideProfileUpdateSchema,
  idParamSchema,
  paginationQuerySchema,
  placeCreateSchema,
  placeSubmitSchema,
  placeUpdateSchema,
  slotBulkCreateSchema,
  slotCreateSchema,
  slotQuerySchema,
  slotUpdateSchema,
  slugParamSchema,
  contentStatusSchema,
  storyCreateSchema,
  storyUpdateSchema,
} from '../../lib/validation';
import { validate } from '../../common/middleware/validate';
import { optionalAuth, requireAuth, requirePortal, requireRoles } from '../../common/middleware/auth';
import { rateLimit, RATE_LIMITS } from '../../common/middleware/rate-limit';
import { type GuideController } from './guide.controller';
import { type PlaceController } from '../places/place.controller';
import { type ExperienceController } from '../experiences/experience.controller';
import { type StoryController } from '../stories/story.controller';
import { type TokenService } from '../auth/token.service';

const ownedListQuerySchema = paginationQuerySchema.extend({
  status: contentStatusSchema.optional(),
});

/** Public guide profile. */
export function publicGuideRoutes(controller: GuideController, tokens: TokenService): Router {
  const router = Router();
  router.get(
    '/:slug',
    optionalAuth(tokens),
    rateLimit(RATE_LIMITS.discovery),
    validate({ params: slugParamSchema }),
    controller.getPublic,
  );
  return router;
}

/**
 * The Tourist Guide portal API. Every route below is gated on the guide portal
 * AND the guide role, and every service call underneath resolves the guide from
 * the token, never from the path.
 */
export function guidePortalRoutes(
  guides: GuideController,
  places: PlaceController,
  experiences: ExperienceController,
  stories: StoryController,
  tokens: TokenService,
): Router {
  const router = Router();
  router.use(requireAuth(tokens), requirePortal('TOURIST_GUIDE'), requireRoles('TOURIST_GUIDE'));

  router.get('/dashboard', guides.dashboardSummary);
  router.get('/analytics', guides.analytics);
  router.get('/', guides.getMine);
  router.patch(
    '/',
    rateLimit(RATE_LIMITS.write),
    validate({ body: guideProfileUpdateSchema }),
    guides.updateMine,
  );
  router.put(
    '/payout',
    rateLimit(RATE_LIMITS.write),
    validate({ body: guidePayoutUpdateSchema }),
    guides.updatePayout,
  );
  router.get('/earnings', guides.earnings);

  // --- places -------------------------------------------------------------
  router.get('/places', validate({ query: ownedListQuerySchema }), places.listMine);
  router.post(
    '/places',
    rateLimit(RATE_LIMITS.write),
    validate({ body: placeCreateSchema }),
    places.create,
  );
  router.get('/places/:id', validate({ params: idParamSchema }), places.getMine);
  router.patch(
    '/places/:id',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: placeUpdateSchema }),
    places.update,
  );
  router.post(
    '/places/:id/submit',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: placeSubmitSchema }),
    places.submit,
  );
  router.delete('/places/:id', validate({ params: idParamSchema }), places.remove);

  // --- experiences ---------------------------------------------------------
  router.get('/experiences', validate({ query: ownedListQuerySchema }), experiences.listMine);
  router.post(
    '/experiences',
    rateLimit(RATE_LIMITS.write),
    validate({ body: experienceCreateSchema }),
    experiences.create,
  );
  router.get('/experiences/:id', validate({ params: idParamSchema }), experiences.getMine);
  router.patch(
    '/experiences/:id',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: experienceUpdateSchema }),
    experiences.update,
  );
  router.post(
    '/experiences/:id/submit',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema }),
    experiences.submit,
  );
  router.delete('/experiences/:id', validate({ params: idParamSchema }), experiences.remove);

  // --- stories -------------------------------------------------------------
  router.get('/stories', validate({ query: ownedListQuerySchema }), stories.listMine);
  router.post(
    '/stories',
    rateLimit(RATE_LIMITS.write),
    validate({ body: storyCreateSchema }),
    stories.create,
  );
  router.get('/stories/:id', validate({ params: idParamSchema }), stories.getMine);
  router.patch(
    '/stories/:id',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: storyUpdateSchema }),
    stories.update,
  );
  router.post(
    '/stories/:id/submit',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema }),
    stories.submit,
  );
  router.delete('/stories/:id', validate({ params: idParamSchema }), stories.remove);

  // --- reviews -------------------------------------------------------------
  router.get('/reviews', validate({ query: paginationQuerySchema }), guides.listReviews);

  // --- availability --------------------------------------------------------
  router.get('/slots', validate({ query: slotQuerySchema }), guides.listSlots);
  router.post(
    '/slots',
    rateLimit(RATE_LIMITS.write),
    validate({ body: slotCreateSchema }),
    guides.createSlot,
  );
  router.post(
    '/slots/bulk',
    rateLimit(RATE_LIMITS.write),
    validate({ body: slotBulkCreateSchema }),
    guides.createSlotsBulk,
  );
  router.patch(
    '/slots/:id',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: slotUpdateSchema }),
    guides.updateSlot,
  );
  router.delete('/slots/:id', validate({ params: idParamSchema }), guides.cancelSlot);

  // --- bookings ------------------------------------------------------------
  router.get('/bookings', validate({ query: bookingQuerySchema }), guides.listBookings);
  router.get('/bookings/:id', validate({ params: idParamSchema }), guides.getBooking);
  router.post(
    '/bookings/:id/action',
    rateLimit(RATE_LIMITS.write),
    validate({ params: idParamSchema, body: guideBookingActionSchema }),
    guides.actOnBooking,
  );

  return router;
}

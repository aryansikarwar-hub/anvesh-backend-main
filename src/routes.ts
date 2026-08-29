import { Router, type Express } from 'express';
import { type Container } from './container';
import { mount } from './common/mount';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { adminAuthRoutes } from './modules/auth/admin-auth.routes';
import { userRoutes } from './modules/users/user.routes';
import { placeRoutes } from './modules/places/place.routes';
import { discoveryRoutes } from './modules/discovery/discovery.routes';
import { categoryRoutes, destinationRoutes } from './modules/taxonomy/taxonomy.routes';
import { experienceRoutes } from './modules/experiences/experience.routes';
import { bookingRoutes } from './modules/bookings/booking.routes';
import { paymentRoutes } from './modules/payments/payment.routes';
import { guidePortalRoutes, publicGuideRoutes } from './modules/guides/guide.routes';
import { reviewRoutes } from './modules/reviews/review.routes';
import { storyRoutes } from './modules/stories/story.routes';
import { tripRoutes } from './modules/trips/trip.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { mediaRoutes } from './modules/media/media.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { docsRoutes } from './modules/docs/docs.routes';

export const API_VERSION = '1.0.0';

/**
 * Every route in the API, mounted under /api/v1.
 *
 * Order matters in two places: the guide portal is mounted at `/guides/me`
 * before the public `/guides/:slug`, and the payment webhook is registered
 * inside its own router before that router's auth middleware.
 */
export function buildRoutes(container: Container, getApp: () => Express): Router {
  const router = Router();
  const { controllers, services, tokens, storage } = container;

  mount(router, '/health', healthRoutes(API_VERSION));
  mount(router, '/docs', docsRoutes(getApp));

  // --- auth ----------------------------------------------------------------
  mount(router, '/auth', authRoutes(controllers.auth, tokens));
  mount(router, '/admin-auth', adminAuthRoutes(controllers.adminAuth, tokens));

  // --- discovery and content (public) --------------------------------------
  mount(router, '/discovery', discoveryRoutes(controllers.discovery, tokens));
  mount(router, '/categories', categoryRoutes(services.taxonomy));
  mount(router, '/destinations', destinationRoutes(services.taxonomy));
  mount(router, '/places', placeRoutes(controllers.places, tokens));
  mount(router, '/experiences', experienceRoutes(controllers.experiences, tokens));
  mount(router, '/reviews', reviewRoutes(controllers.reviews, tokens));
  mount(router, '/stories', storyRoutes(controllers.stories, tokens));

  // --- traveller portal ----------------------------------------------------
  mount(router, '/users', userRoutes(controllers.users, tokens));
  mount(router, '/trips', tripRoutes(controllers.trips, tokens));
  mount(router, '/bookings', bookingRoutes(controllers.bookings, tokens));
  mount(router, '/payments', paymentRoutes(controllers.payments, tokens));
  mount(router, '/ai', aiRoutes(controllers.ai, tokens));

  // --- shared --------------------------------------------------------------
  mount(router, '/media', mediaRoutes(services.media, storage, tokens));
  mount(router, '/notifications', notificationRoutes(services.notifications, tokens));

  // --- tourist guide portal (mounted before the public guide route) --------
  mount(
    router,
    '/guides/me',
    guidePortalRoutes(
      controllers.guides,
      controllers.places,
      controllers.experiences,
      controllers.stories,
      tokens,
    ),
  );
  mount(router, '/guides', publicGuideRoutes(controllers.guides, tokens));

  // --- admin portal --------------------------------------------------------
  mount(router, '/admin', adminRoutes(controllers.admin, tokens));

  return router;
}

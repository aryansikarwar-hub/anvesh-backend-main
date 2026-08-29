export interface OperationMeta {
  summary: string;
  /** Which portal a token must be minted for, or null for public routes. */
  portal: 'TRAVELLER' | 'TOURIST_GUIDE' | 'ADMIN' | 'ANY' | null;
  tag: string;
}

/**
 * Documentation for every operation the API serves.
 *
 * `openapi.spec.ts` asserts that this map and the live Express router describe
 * exactly the same set of routes, so the published document can never claim an
 * endpoint that does not exist, nor miss one that does.
 */
export const OPERATIONS: Record<string, OperationMeta> = {
  // --- health --------------------------------------------------------------
  'GET /api/v1/health/live': { summary: 'Liveness probe', portal: null, tag: 'Health' },
  'GET /api/v1/health/ready': { summary: 'Readiness probe including MongoDB replica set and Redis', portal: null, tag: 'Health' },

  // The Swagger UI itself is static middleware at /api/v1/docs, not an API
  // operation, so it is intentionally absent from this map.
  'GET /api/v1/docs/openapi.json': { summary: 'The OpenAPI document, generated from the live router', portal: null, tag: 'Health' },

  // --- auth ----------------------------------------------------------------
  'POST /api/v1/auth/register': { summary: 'Create a traveller or tourist guide account', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/login': { summary: 'Sign in to a named portal', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/refresh': { summary: 'Rotate the refresh token and issue a new access token', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/logout': { summary: 'Revoke the current session, optionally every session', portal: 'ANY', tag: 'Auth' },
  'GET /api/v1/auth/me': { summary: 'The signed-in user', portal: 'ANY', tag: 'Auth' },
  'POST /api/v1/auth/verify-email': { summary: 'Confirm an email address with a one-time token', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/resend-verification': { summary: 'Send another verification email', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/forgot-password': { summary: 'Request a password reset link', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/reset-password': { summary: 'Set a new password with a reset token', portal: null, tag: 'Auth' },
  'POST /api/v1/auth/change-password': { summary: 'Change the password of the signed-in user', portal: 'ANY', tag: 'Auth' },

  // --- admin auth ----------------------------------------------------------
  'POST /api/v1/admin-auth/login': { summary: 'Admin password step; returns a TOTP challenge, never a session', portal: null, tag: 'Admin auth' },
  'POST /api/v1/admin-auth/totp': { summary: 'Complete the TOTP challenge and receive an admin session', portal: null, tag: 'Admin auth' },
  'POST /api/v1/admin-auth/invites': { summary: 'Invite a new admin', portal: 'ADMIN', tag: 'Admin auth' },
  'POST /api/v1/admin-auth/invites/accept': { summary: 'Accept an admin invitation', portal: null, tag: 'Admin auth' },

  // --- discovery -----------------------------------------------------------
  'GET /api/v1/discovery/search': { summary: 'Search places; ranked with the popularity penalty applied', portal: null, tag: 'Discovery' },
  'GET /api/v1/discovery/nearby': { summary: 'Places near a coordinate, geo-first', portal: null, tag: 'Discovery' },
  'GET /api/v1/discovery/map': { summary: 'Places inside a bounding box, for map discovery', portal: null, tag: 'Discovery' },
  'GET /api/v1/discovery/feed': { summary: 'Personalised home feed', portal: null, tag: 'Discovery' },
  'GET /api/v1/discovery/hidden-gems': { summary: 'Places that are still genuinely unpopular', portal: null, tag: 'Discovery' },

  // --- taxonomy ------------------------------------------------------------
  'GET /api/v1/categories': { summary: 'The category taxonomy', portal: null, tag: 'Taxonomy' },
  'GET /api/v1/destinations': { summary: 'Published destinations', portal: null, tag: 'Taxonomy' },
  'GET /api/v1/destinations/:slug': { summary: 'One destination with a live place count', portal: null, tag: 'Taxonomy' },

  // --- content -------------------------------------------------------------
  'GET /api/v1/places/:slug': { summary: 'A published place; increments its view counter', portal: null, tag: 'Places' },
  'GET /api/v1/experiences': { summary: 'Published experiences', portal: null, tag: 'Experiences' },
  'GET /api/v1/experiences/:slug': { summary: 'One published experience', portal: null, tag: 'Experiences' },
  'GET /api/v1/experiences/:id/availability': { summary: 'Open slots for an experience', portal: null, tag: 'Experiences' },
  'GET /api/v1/guides/:slug': { summary: 'A verified tourist guide profile', portal: null, tag: 'Guides' },

  // --- reviews -------------------------------------------------------------
  'GET /api/v1/reviews': { summary: 'Published reviews for one target', portal: null, tag: 'Reviews' },
  'POST /api/v1/reviews': { summary: 'Write a review', portal: 'TRAVELLER', tag: 'Reviews' },
  'GET /api/v1/reviews/mine': { summary: 'Reviews written by the signed-in traveller', portal: 'TRAVELLER', tag: 'Reviews' },
  'PATCH /api/v1/reviews/:id': { summary: 'Edit your own review, within the edit window', portal: 'TRAVELLER', tag: 'Reviews' },
  'DELETE /api/v1/reviews/:id': { summary: 'Delete your own review', portal: 'TRAVELLER', tag: 'Reviews' },
  'POST /api/v1/reviews/:id/report': { summary: 'Report a review to moderators', portal: 'TRAVELLER', tag: 'Reviews' },

  // --- users ---------------------------------------------------------------
  'PATCH /api/v1/users/me': { summary: 'Update your profile', portal: 'ANY', tag: 'Users' },
  'PATCH /api/v1/users/me/preferences': { summary: 'Update discovery preferences', portal: 'ANY', tag: 'Users' },
  'GET /api/v1/users/me/saved': { summary: 'Saved places', portal: 'ANY', tag: 'Users' },
  'POST /api/v1/users/me/saved': { summary: 'Save a place', portal: 'ANY', tag: 'Users' },
  'DELETE /api/v1/users/me/saved/:id': { summary: 'Remove a saved place', portal: 'ANY', tag: 'Users' },
  'GET /api/v1/users/me/collections': { summary: 'Your collections', portal: 'ANY', tag: 'Users' },
  'POST /api/v1/users/me/collections': { summary: 'Create a collection', portal: 'ANY', tag: 'Users' },
  'PATCH /api/v1/users/me/collections/:id': { summary: 'Rename or edit a collection', portal: 'ANY', tag: 'Users' },
  'DELETE /api/v1/users/me/collections/:id': { summary: 'Delete a collection', portal: 'ANY', tag: 'Users' },

  // --- trips ---------------------------------------------------------------
  'GET /api/v1/trips': { summary: 'Your trips', portal: 'TRAVELLER', tag: 'Trips' },
  'POST /api/v1/trips': { summary: 'Create a trip', portal: 'TRAVELLER', tag: 'Trips' },
  'GET /api/v1/trips/:id': { summary: 'One trip with its days and activities', portal: 'TRAVELLER', tag: 'Trips' },
  'PATCH /api/v1/trips/:id': { summary: 'Edit a trip', portal: 'TRAVELLER', tag: 'Trips' },
  'DELETE /api/v1/trips/:id': { summary: 'Delete a trip', portal: 'TRAVELLER', tag: 'Trips' },
  'POST /api/v1/trips/:id/days': { summary: 'Add a day', portal: 'TRAVELLER', tag: 'Trips' },
  'PATCH /api/v1/trips/:id/days/:dayId': { summary: 'Edit a day', portal: 'TRAVELLER', tag: 'Trips' },
  'DELETE /api/v1/trips/:id/days/:dayId': { summary: 'Remove a day and renumber the rest', portal: 'TRAVELLER', tag: 'Trips' },
  'POST /api/v1/trips/:id/days/:dayId/activities': { summary: 'Add an activity; place and experience ids are verified', portal: 'TRAVELLER', tag: 'Trips' },
  'DELETE /api/v1/trips/:id/days/:dayId/activities/:activityId': { summary: 'Remove an activity', portal: 'TRAVELLER', tag: 'Trips' },
  'PUT /api/v1/trips/:id/days/:dayId/order': { summary: 'Reorder a day; the complete id list is required', portal: 'TRAVELLER', tag: 'Trips' },

  // --- bookings and payments ----------------------------------------------
  'GET /api/v1/bookings': { summary: 'Your bookings', portal: 'TRAVELLER', tag: 'Bookings' },
  'POST /api/v1/bookings': { summary: 'Create a booking and atomically hold the seats', portal: 'TRAVELLER', tag: 'Bookings' },
  'GET /api/v1/bookings/:id': { summary: 'One of your bookings', portal: 'TRAVELLER', tag: 'Bookings' },
  'POST /api/v1/bookings/:id/cancel': { summary: 'Cancel your booking and release the seats', portal: 'TRAVELLER', tag: 'Bookings' },
  'POST /api/v1/payments/order': { summary: 'Create a Razorpay order for a pending booking', portal: 'TRAVELLER', tag: 'Payments' },
  'POST /api/v1/payments/verify': { summary: 'Verify the checkout signature and confirm the booking', portal: 'TRAVELLER', tag: 'Payments' },
  'GET /api/v1/payments/by-booking/:id': { summary: 'The payment for one of your bookings', portal: 'TRAVELLER', tag: 'Payments' },
  'POST /api/v1/payments/webhook': { summary: 'Razorpay webhook; authenticated by HMAC over the raw body', portal: null, tag: 'Payments' },

  // --- ai ------------------------------------------------------------------
  'GET /api/v1/ai/status': { summary: 'Which AI provider is answering, and whether it is degraded', portal: null, tag: 'AI' },
  'POST /api/v1/ai/discover': { summary: 'Natural-language discovery over real database records only', portal: 'TRAVELLER', tag: 'AI' },
  'POST /api/v1/ai/itinerary': { summary: 'Generate an itinerary; every place id is verified before it is returned', portal: 'TRAVELLER', tag: 'AI' },

  // --- stories -------------------------------------------------------------
  'GET /api/v1/stories': { summary: 'Published local stories', portal: null, tag: 'Stories' },
  'GET /api/v1/stories/:slug': { summary: 'One published story with the places it is about', portal: null, tag: 'Stories' },
  'GET /api/v1/guides/me/stories': { summary: 'Your own stories, any status', portal: 'TOURIST_GUIDE', tag: 'Stories' },
  'POST /api/v1/guides/me/stories': { summary: 'Write a story', portal: 'TOURIST_GUIDE', tag: 'Stories' },
  'GET /api/v1/guides/me/stories/:id': { summary: 'One of your stories', portal: 'TOURIST_GUIDE', tag: 'Stories' },
  'PATCH /api/v1/guides/me/stories/:id': { summary: 'Edit a story; a published one returns to review', portal: 'TOURIST_GUIDE', tag: 'Stories' },
  'POST /api/v1/guides/me/stories/:id/submit': { summary: 'Submit a story for moderation', portal: 'TOURIST_GUIDE', tag: 'Stories' },
  'DELETE /api/v1/guides/me/stories/:id': { summary: 'Delete one of your stories', portal: 'TOURIST_GUIDE', tag: 'Stories' },
  'GET /api/v1/admin/stories': { summary: 'Story moderation queue', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/stories/:id/moderate': { summary: 'Publish, reject or archive a story', portal: 'ADMIN', tag: 'Admin' },

  // --- media and notifications --------------------------------------------
  'PUT /api/v1/media/upload/:token': { summary: 'Upload the bytes for a previously approved media key', portal: null, tag: 'Media' },
  'POST /api/v1/media/presign': { summary: 'Presign an upload with the content type and length pinned', portal: 'ANY', tag: 'Media' },
  'POST /api/v1/media/finalise': { summary: 'Confirm an upload landed and record its metadata', portal: 'ANY', tag: 'Media' },
  'GET /api/v1/media': { summary: 'Your uploaded media', portal: 'ANY', tag: 'Media' },
  'DELETE /api/v1/media/:id': { summary: 'Delete one of your uploads', portal: 'ANY', tag: 'Media' },
  'GET /api/v1/notifications': { summary: 'Your notification feed', portal: 'ANY', tag: 'Notifications' },
  'POST /api/v1/notifications/:id/read': { summary: 'Mark one notification read', portal: 'ANY', tag: 'Notifications' },
  'POST /api/v1/notifications/read-all': { summary: 'Mark every notification read', portal: 'ANY', tag: 'Notifications' },

  // --- tourist guide portal ------------------------------------------------
  'GET /api/v1/guides/me': { summary: 'Your guide profile', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'PATCH /api/v1/guides/me': { summary: 'Update your guide profile', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'PUT /api/v1/guides/me/payout': { summary: 'Store payout details, encrypted at rest', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/dashboard': { summary: 'Live dashboard aggregates for your own records', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/analytics': { summary: 'Views, saves and conversion for your places', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/earnings': { summary: 'Earnings after platform commission', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/reviews': { summary: 'Reviews on your own experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/places': { summary: 'Your places', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/places': { summary: 'Add a place as a draft', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/places/:id': { summary: 'One of your places', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'PATCH /api/v1/guides/me/places/:id': { summary: 'Edit one of your places', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/places/:id/submit': { summary: 'Submit a place for moderation', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'DELETE /api/v1/guides/me/places/:id': { summary: 'Soft delete one of your places', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/experiences': { summary: 'Your experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/experiences': { summary: 'Create an experience as a draft', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/experiences/:id': { summary: 'One of your experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'PATCH /api/v1/guides/me/experiences/:id': { summary: 'Edit one of your experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/experiences/:id/submit': { summary: 'Submit an experience for moderation', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'DELETE /api/v1/guides/me/experiences/:id': { summary: 'Archive one of your experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/slots': { summary: 'Your availability slots', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/slots': { summary: 'Create one slot', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/slots/bulk': { summary: 'Generate a bounded run of slots from a weekly pattern', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'PATCH /api/v1/guides/me/slots/:id': { summary: 'Change seats, price or open state on a slot', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'DELETE /api/v1/guides/me/slots/:id': { summary: 'Cancel an unbooked slot', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/bookings': { summary: 'Bookings on your experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'GET /api/v1/guides/me/bookings/:id': { summary: 'One booking on your experiences', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },
  'POST /api/v1/guides/me/bookings/:id/action': { summary: 'Complete or cancel a booking you host', portal: 'TOURIST_GUIDE', tag: 'Guide portal' },

  // --- admin portal --------------------------------------------------------
  'GET /api/v1/admin/dashboard': { summary: 'Platform dashboard aggregates', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/analytics': { summary: 'Bookings and events over time', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/ai/monitoring': { summary: 'AI verdicts and recent rejections', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/system/health': { summary: 'MongoDB, replica set, Redis and sweep backlog', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/audit-logs': { summary: 'Append-only admin audit trail', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/places': { summary: 'Places in any state, for moderation', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/places/:id/moderate': { summary: 'Publish, reject or archive a place', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/experiences': { summary: 'Experiences in any state', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/experiences/:id/moderate': { summary: 'Publish, reject or archive an experience', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/reviews': { summary: 'Reviews, optionally only reported ones', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/reviews/:id/moderate': { summary: 'Hide, remove or restore a review', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/reports': { summary: 'Content reports raised by travellers', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/reports/:id/resolve': { summary: 'Resolve or dismiss a report', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/users': { summary: 'Search and filter users', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/users/:id': { summary: 'One user', portal: 'ADMIN', tag: 'Admin' },
  'PATCH /api/v1/admin/users/:id': { summary: 'Change a user status or role; audited', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/guides': { summary: 'Tourist guide profiles', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/guides/:id/verify': { summary: 'Verify or unverify a guide; audited', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/bookings': { summary: 'Every booking on the platform', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/payments': { summary: 'Every payment on the platform', portal: 'ADMIN', tag: 'Admin' },
  'POST /api/v1/admin/refunds': { summary: 'Issue a refund; the amount is recomputed server-side', portal: 'ADMIN', tag: 'Admin' },
  'GET /api/v1/admin/recommendation-config': { summary: 'The active ranking configuration and its history', portal: 'ADMIN', tag: 'Admin' },
  'PUT /api/v1/admin/recommendation-config': { summary: 'Save a new ranking configuration version; penalties cannot be zeroed', portal: 'ADMIN', tag: 'Admin' },
};

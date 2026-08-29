/**
 * Creates every collection explicitly. `autoCreate` is off in the application,
 * so a collection only exists because a migration made it.
 */
const COLLECTIONS = [
  'users',
  'refreshtokens',
  'verificationtokens',
  'admininvites',
  'guideprofiles',
  'places',
  'destinations',
  'categories',
  'experiences',
  'availabilityslots',
  'bookings',
  'payments',
  'reviews',
  'reports',
  'trips',
  'savedplaces',
  'collections',
  'notifications',
  'mediaassets',
  'recommendationconfigs',
  'airequestlogs',
  'analyticsevents',
  'placedailystats',
  'auditlogs',
  'outboxevents',
  'idempotencyrecords',
];

module.exports = {
  async up(db) {
    const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
    for (const name of COLLECTIONS) {
      if (!existing.has(name)) await db.createCollection(name);
    }
  },

  async down(db) {
    for (const name of COLLECTIONS) {
      await db.collection(name).drop().catch(() => undefined);
    }
  },
};

/**
 * TTL indexes. Mongo removes these documents on its own so no cleanup job has
 * to be correct for the data to stay bounded.
 */
module.exports = {
  async up(db) {
    await db
      .collection('refreshtokens')
      .createIndex({ expiresAt: 1 }, { name: 'ttl_expires', expireAfterSeconds: 0 });
    await db
      .collection('verificationtokens')
      .createIndex({ expiresAt: 1 }, { name: 'ttl_expires', expireAfterSeconds: 0 });
    await db
      .collection('admininvites')
      .createIndex({ expiresAt: 1 }, { name: 'ttl_expires', expireAfterSeconds: 604800 });
    await db
      .collection('notifications')
      .createIndexes([
        { key: { userId: 1, createdAt: -1 }, name: 'user_recent' },
        { key: { userId: 1, readAt: 1 }, name: 'user_unread' },
        { key: { expiresAt: 1 }, name: 'ttl_expires', expireAfterSeconds: 0 },
      ]);
    await db
      .collection('airequestlogs')
      .createIndexes([
        { key: { userId: 1, createdAt: -1 }, name: 'user_recent' },
        { key: { verdict: 1, createdAt: -1 }, name: 'verdict_recent' },
        { key: { expiresAt: 1 }, name: 'ttl_expires', expireAfterSeconds: 0 },
      ]);
    await db
      .collection('analyticsevents')
      .createIndexes([
        { key: { type: 1, occurredAt: -1 }, name: 'type_recent' },
        { key: { placeId: 1, occurredAt: -1 }, name: 'place_recent' },
        { key: { userId: 1, occurredAt: -1 }, name: 'user_recent' },
        { key: { expiresAt: 1 }, name: 'ttl_expires', expireAfterSeconds: 0 },
      ]);
    await db
      .collection('placedailystats')
      .createIndexes([
        { key: { placeId: 1, day: 1 }, name: 'uniq_place_day', unique: true },
        { key: { day: -1 }, name: 'day_desc' },
      ]);
    await db
      .collection('auditlogs')
      .createIndexes([
        { key: { createdAt: -1 }, name: 'recent' },
        { key: { actorId: 1, createdAt: -1 }, name: 'actor_recent' },
        { key: { targetType: 1, targetId: 1, createdAt: -1 }, name: 'target_recent' },
        { key: { action: 1, createdAt: -1 }, name: 'action_recent' },
      ]);
    await db
      .collection('outboxevents')
      .createIndexes([
        { key: { status: 1, createdAt: 1 }, name: 'pending_queue' },
        { key: { expiresAt: 1 }, name: 'ttl_expires', expireAfterSeconds: 0 },
      ]);
    await db
      .collection('idempotencyrecords')
      .createIndexes([
        { key: { key: 1, scope: 1 }, name: 'uniq_key_scope', unique: true },
        { key: { expiresAt: 1 }, name: 'ttl_expires', expireAfterSeconds: 0 },
      ]);
  },

  async down(db) {
    for (const name of [
      'refreshtokens',
      'verificationtokens',
      'admininvites',
      'notifications',
      'airequestlogs',
      'analyticsevents',
      'placedailystats',
      'auditlogs',
      'outboxevents',
      'idempotencyrecords',
    ]) {
      await db.collection(name).dropIndexes().catch(() => undefined);
    }
  },
};

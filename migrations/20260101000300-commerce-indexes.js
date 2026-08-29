/** Availability, booking and payment indexes. */
const notDeleted = { deletedAt: null };

module.exports = {
  async up(db) {
    await db
      .collection('availabilityslots')
      .createIndexes([
        {
          key: { experienceId: 1, startAt: 1 },
          name: 'uniq_experience_start_active',
          unique: true,
          partialFilterExpression: notDeleted,
        },
        { key: { guideId: 1, startAt: 1 }, name: 'guide_start' },
        { key: { startAt: 1, status: 1 }, name: 'start_status' },
        { key: { status: 1, seatsAvailable: 1 }, name: 'open_with_seats' },
      ]);

    await db
      .collection('bookings')
      .createIndexes([
        { key: { code: 1 }, name: 'uniq_code', unique: true },
        {
          key: { idempotencyKey: 1 },
          name: 'uniq_idempotency_active',
          unique: true,
          partialFilterExpression: notDeleted,
        },
        { key: { userId: 1, createdAt: -1 }, name: 'user_recent' },
        { key: { guideId: 1, startAt: -1 }, name: 'guide_upcoming' },
        { key: { slotId: 1, status: 1 }, name: 'slot_status' },
        { key: { status: 1, expiresAt: 1 }, name: 'expiry_sweep' },
        { key: { experienceId: 1, status: 1 }, name: 'experience_status' },
      ]);

    await db
      .collection('payments')
      .createIndexes([
        { key: { bookingId: 1 }, name: 'booking' },
        { key: { providerOrderId: 1 }, name: 'uniq_order', unique: true },
        {
          key: { providerPaymentId: 1 },
          name: 'uniq_provider_payment',
          unique: true,
          partialFilterExpression: { providerPaymentId: { $type: 'string' } },
        },
        { key: { userId: 1, createdAt: -1 }, name: 'user_recent' },
        { key: { status: 1, updatedAt: -1 }, name: 'status_recent' },
        { key: { 'webhookEvents.eventId': 1 }, name: 'webhook_dedup' },
      ]);

    await db
      .collection('reports')
      .createIndexes([
        { key: { status: 1, createdAt: -1 }, name: 'queue' },
        { key: { targetType: 1, targetId: 1 }, name: 'target' },
      ]);

    await db
      .collection('mediaassets')
      .createIndexes([
        { key: { key: 1 }, name: 'uniq_key', unique: true },
        { key: { ownerId: 1, createdAt: -1 }, name: 'owner_recent' },
        { key: { status: 1, createdAt: 1 }, name: 'pending_sweep' },
      ]);

    await db.collection('recommendationconfigs').createIndexes([
      {
        key: { active: 1 },
        name: 'uniq_single_active',
        unique: true,
        partialFilterExpression: { active: true, deletedAt: null },
      },
      { key: { version: -1 }, name: 'version_desc' },
    ]);
  },

  async down(db) {
    for (const name of [
      'availabilityslots',
      'bookings',
      'payments',
      'reports',
      'mediaassets',
      'recommendationconfigs',
    ]) {
      await db.collection(name).dropIndexes().catch(() => undefined);
    }
  },
};

/**
 * Discovery indexes.
 *
 * `geo_location` is a 2dsphere index; every $geoNear query uses it and must
 * place $geoNear as the first aggregation stage. `place_text` powers text
 * search with title weighted above summary and description.
 */
const notDeleted = { deletedAt: null };

module.exports = {
  async up(db) {
    await db
      .collection('places')
      .createIndexes([
        { key: { slug: 1 }, name: 'uniq_slug_active', unique: true, partialFilterExpression: notDeleted },
        { key: { location: '2dsphere' }, name: 'geo_location' },
        {
          key: { title: 'text', summary: 'text', description: 'text', 'address.city': 'text' },
          name: 'place_text',
          weights: { title: 10, summary: 5, 'address.city': 4, description: 1 },
          default_language: 'english',
        },
        { key: { status: 1, discoveryScore: -1 }, name: 'status_discovery' },
        { key: { categorySlugs: 1, status: 1 }, name: 'categories_status' },
        { key: { 'guideSummary.guideId': 1, status: 1 }, name: 'guide_status' },
        { key: { destinationId: 1, status: 1 }, name: 'destination_status' },
        { key: { 'address.state': 1, 'address.city': 1, status: 1 }, name: 'location_status' },
        { key: { 'signals.popularityScore': 1, 'signals.qualityScore': -1 }, name: 'hidden_gems' },
        { key: { createdBy: 1, status: 1 }, name: 'creator_status' },
      ]);

    await db
      .collection('experiences')
      .createIndexes([
        { key: { slug: 1 }, name: 'uniq_slug_active', unique: true, partialFilterExpression: notDeleted },
        { key: { guideId: 1, status: 1 }, name: 'guide_status' },
        { key: { categorySlugs: 1, status: 1 }, name: 'categories_status' },
        { key: { 'meetingPoint.location': '2dsphere' }, name: 'geo_meeting_point' },
        {
          key: { title: 'text', summary: 'text', description: 'text' },
          name: 'experience_text',
          weights: { title: 10, summary: 5, description: 1 },
          default_language: 'english',
        },
        { key: { 'placeSummary.placeId': 1, status: 1 }, name: 'place_status' },
      ]);

    await db
      .collection('reviews')
      .createIndexes([
        { key: { targetType: 1, targetId: 1, status: 1, createdAt: -1 }, name: 'target_recent' },
        {
          key: { userId: 1, targetType: 1, targetId: 1 },
          name: 'uniq_user_target_active',
          unique: true,
          partialFilterExpression: notDeleted,
        },
        { key: { status: 1, reportCount: -1 }, name: 'moderation_queue' },
      ]);

    await db
      .collection('savedplaces')
      .createIndexes([
        {
          key: { userId: 1, placeId: 1 },
          name: 'uniq_user_place_active',
          unique: true,
          partialFilterExpression: notDeleted,
        },
        { key: { userId: 1, collectionId: 1, createdAt: -1 }, name: 'user_collection' },
      ]);

    await db
      .collection('collections')
      .createIndexes([{ key: { userId: 1, createdAt: -1 }, name: 'user_recent' }]);

    await db
      .collection('trips')
      .createIndexes([
        { key: { userId: 1, updatedAt: -1 }, name: 'user_recent' },
        { key: { destinationId: 1 }, name: 'destination' },
      ]);
  },

  async down(db) {
    for (const name of ['places', 'experiences', 'reviews', 'savedplaces', 'collections', 'trips']) {
      await db.collection(name).dropIndexes().catch(() => undefined);
    }
  },
};

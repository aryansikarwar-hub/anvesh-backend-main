/** Identity, auth and taxonomy indexes. */
const notDeleted = { deletedAt: null };

module.exports = {
  async up(db) {
    await db
      .collection('users')
      .createIndexes([
        { key: { email: 1 }, name: 'uniq_email_active', unique: true, partialFilterExpression: notDeleted },
        { key: { role: 1, status: 1 }, name: 'role_status' },
        { key: { 'preferences.interests': 1 }, name: 'pref_interests' },
        { key: { createdAt: -1 }, name: 'created_desc' },
      ]);

    await db
      .collection('refreshtokens')
      .createIndexes([
        { key: { tokenHash: 1 }, name: 'uniq_token_hash', unique: true },
        { key: { userId: 1, portal: 1 }, name: 'user_portal' },
        { key: { familyId: 1 }, name: 'family' },
      ]);

    await db
      .collection('verificationtokens')
      .createIndexes([
        { key: { tokenHash: 1 }, name: 'uniq_token_hash', unique: true },
        { key: { userId: 1, purpose: 1 }, name: 'user_purpose' },
      ]);

    await db
      .collection('admininvites')
      .createIndexes([
        { key: { tokenHash: 1 }, name: 'uniq_token_hash', unique: true },
        { key: { email: 1, acceptedAt: 1 }, name: 'email_accepted' },
      ]);

    await db
      .collection('guideprofiles')
      .createIndexes([
        { key: { slug: 1 }, name: 'uniq_slug_active', unique: true, partialFilterExpression: notDeleted },
        { key: { userId: 1 }, name: 'uniq_user_active', unique: true, partialFilterExpression: notDeleted },
        { key: { verified: 1, ratingAvg: -1 }, name: 'verified_rating' },
        { key: { baseState: 1, baseCity: 1 }, name: 'base_location' },
      ]);

    await db
      .collection('categories')
      .createIndexes([
        { key: { slug: 1 }, name: 'uniq_slug_active', unique: true, partialFilterExpression: notDeleted },
        { key: { parentSlug: 1, sortOrder: 1 }, name: 'parent_sort' },
      ]);

    await db
      .collection('destinations')
      .createIndexes([
        { key: { slug: 1 }, name: 'uniq_slug_active', unique: true, partialFilterExpression: notDeleted },
        { key: { location: '2dsphere' }, name: 'geo_location' },
        { key: { state: 1, status: 1 }, name: 'state_status' },
      ]);
  },

  async down(db) {
    for (const name of [
      'users',
      'refreshtokens',
      'verificationtokens',
      'admininvites',
      'guideprofiles',
      'categories',
      'destinations',
    ]) {
      await db.collection(name).dropIndexes().catch(() => undefined);
    }
  },
};

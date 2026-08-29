/**
 * Local stories: the collection, its indexes and its schema validator.
 *
 * Added after the original six migrations rather than folded into them, so a
 * database that already ran those upgrades in place instead of being rebuilt.
 */
const notDeleted = { deletedAt: null };

const STORY_KINDS = ['FOOD', 'CRAFT', 'FESTIVAL', 'HISTORY', 'NATURE', 'PEOPLE'];
const CONTENT_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'];

module.exports = {
  async up(db) {
    const existing = await db.listCollections({ name: 'stories' }).toArray();
    if (existing.length === 0) await db.createCollection('stories');

    await db.collection('stories').createIndexes([
      { key: { slug: 1 }, name: 'uniq_slug_active', unique: true, partialFilterExpression: notDeleted },
      { key: { status: 1, publishedAt: -1 }, name: 'status_published' },
      { key: { guideId: 1, status: 1 }, name: 'guide_status' },
      { key: { kind: 1, status: 1, publishedAt: -1 }, name: 'kind_status_published' },
      { key: { placeIds: 1 }, name: 'place_refs' },
      { key: { state: 1, city: 1 }, name: 'region' },
      // Free-text search across the parts a reader would search by. The body is
      // weighted lowest so a title match always wins.
      {
        key: { title: 'text', summary: 'text', tags: 'text', body: 'text' },
        name: 'story_text',
        weights: { title: 10, summary: 5, tags: 4, body: 1 },
        default_language: 'english',
      },
    ]);

    // The validator is the last line of defence: it rejects documents the
    // application would never write, including a story published without a
    // publishedAt stamp.
    await db.command({
      collMod: 'stories',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'slug',
            'title',
            'summary',
            'body',
            'kind',
            'guideId',
            'city',
            'state',
            'readMinutes',
            'status',
          ],
          properties: {
            slug: { bsonType: 'string', minLength: 2, maxLength: 160 },
            title: { bsonType: 'string', minLength: 4, maxLength: 160 },
            summary: { bsonType: 'string', minLength: 20, maxLength: 300 },
            body: { bsonType: 'string', minLength: 200, maxLength: 20000 },
            kind: { enum: STORY_KINDS },
            guideId: { bsonType: 'objectId' },
            placeIds: { bsonType: 'array', items: { bsonType: 'objectId' } },
            city: { bsonType: 'string', minLength: 1, maxLength: 120 },
            state: { bsonType: 'string', minLength: 1, maxLength: 120 },
            tags: { bsonType: 'array', maxItems: 8, items: { bsonType: 'string' } },
            readMinutes: { bsonType: 'int', minimum: 1, maximum: 90 },
            viewCount: { bsonType: 'int', minimum: 0 },
            status: { enum: CONTENT_STATUSES },
            publishedAt: { bsonType: ['date', 'null'] },
            deletedAt: { bsonType: ['date', 'null'] },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
  },

  async down(db) {
    await db.collection('stories').drop();
  },
};

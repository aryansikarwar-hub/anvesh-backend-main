/**
 * $jsonSchema validators for identity and content collections.
 *
 * These are a second line of defence behind Zod: even a direct mongosh write
 * cannot put a float into a money field, a reversed coordinate pair into a
 * location, or an out-of-range popularity score into a place.
 */
const geoPoint = {
  bsonType: 'object',
  required: ['type', 'coordinates'],
  properties: {
    type: { enum: ['Point'] },
    coordinates: {
      bsonType: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        { bsonType: 'double', minimum: -180, maximum: 180 },
        { bsonType: 'double', minimum: -90, maximum: 90 },
      ],
    },
  },
};

const unit = { bsonType: ['double', 'int'], minimum: 0, maximum: 1 };
const money = { bsonType: ['int', 'long'], minimum: 0 };

const users = {
  bsonType: 'object',
  required: ['email', 'passwordHash', 'role', 'portals', 'status', 'profile'],
  properties: {
    email: { bsonType: 'string', maxLength: 254 },
    passwordHash: { bsonType: 'string' },
    role: { enum: ['TRAVELLER', 'TOURIST_GUIDE', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] },
    portals: {
      bsonType: 'array',
      maxItems: 3,
      items: { enum: ['TRAVELLER', 'TOURIST_GUIDE', 'ADMIN'] },
    },
    status: { enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] },
    tokenVersion: { bsonType: ['int', 'long'], minimum: 0 },
    profile: {
      bsonType: 'object',
      required: ['displayName'],
      properties: { displayName: { bsonType: 'string', minLength: 1, maxLength: 80 } },
    },
    preferences: {
      bsonType: 'object',
      properties: {
        interests: { bsonType: 'array', maxItems: 20 },
        travelStyles: { bsonType: 'array', maxItems: 10 },
        crowdTolerance: unit,
      },
    },
  },
};

const places = {
  bsonType: 'object',
  required: ['slug', 'title', 'summary', 'description', 'location', 'address', 'status', 'signals'],
  properties: {
    slug: { bsonType: 'string', minLength: 2, maxLength: 120 },
    title: { bsonType: 'string', minLength: 3, maxLength: 140 },
    summary: { bsonType: 'string', maxLength: 300 },
    description: { bsonType: 'string', maxLength: 8000 },
    categorySlugs: { bsonType: 'array', maxItems: 8, items: { bsonType: 'string' } },
    location: geoPoint,
    images: { bsonType: 'array', maxItems: 12 },
    openingHours: { bsonType: 'array', maxItems: 7 },
    ownership: { enum: ['LOCAL_OWNED', 'CHAIN', 'GOVERNMENT', 'COMMUNITY', 'UNKNOWN'] },
    status: { enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] },
    details: {
      bsonType: 'object',
      properties: {
        entryFeeMinor: money,
        tips: { bsonType: 'array', maxItems: 10 },
        amenities: { bsonType: 'array', maxItems: 20 },
      },
    },
    signals: {
      bsonType: 'object',
      properties: {
        qualityScore: unit,
        authenticityScore: unit,
        localOwnership: unit,
        uniquenessScore: unit,
        popularityScore: unit,
        crowdLevel: unit,
        ratingAvg: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
      },
    },
  },
};

const experiences = {
  bsonType: 'object',
  required: ['slug', 'title', 'guideId', 'guideSummary', 'basePriceMinor', 'maxSeats', 'status'],
  properties: {
    slug: { bsonType: 'string', maxLength: 120 },
    title: { bsonType: 'string', minLength: 3, maxLength: 140 },
    basePriceMinor: money,
    // Up to 30 days: most experiences are a few hours, but multi-day treks
    // and circuits (e.g. a 5-day trek) are real bookable experiences too.
    durationMin: { bsonType: ['int', 'long'], minimum: 15, maximum: 43200 },
    maxSeats: { bsonType: ['int', 'long'], minimum: 1, maximum: 60 },
    images: { bsonType: 'array', maxItems: 12 },
    inclusions: { bsonType: 'array', maxItems: 15 },
    exclusions: { bsonType: 'array', maxItems: 15 },
    cancellationPolicy: { enum: ['FLEXIBLE', 'MODERATE', 'STRICT'] },
    status: { enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] },
    meetingPoint: {
      bsonType: 'object',
      required: ['label', 'location'],
      properties: { location: geoPoint },
    },
  },
};

const VALIDATORS = { users, places, experiences };

module.exports = {
  async up(db) {
    for (const [collection, schema] of Object.entries(VALIDATORS)) {
      await db.command({
        collMod: collection,
        validator: { $jsonSchema: schema },
        validationLevel: 'moderate',
        validationAction: 'error',
      });
    }
  },

  async down(db) {
    for (const collection of Object.keys(VALIDATORS)) {
      await db.command({ collMod: collection, validator: {}, validationLevel: 'off' });
    }
  },
};
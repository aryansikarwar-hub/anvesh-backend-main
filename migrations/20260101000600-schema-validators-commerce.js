/** $jsonSchema validators for commerce, trips and ranking configuration. */
const money = { bsonType: ['int', 'long'], minimum: 0 };
const unit = { bsonType: ['double', 'int'], minimum: 0, maximum: 1 };

const availabilityslots = {
  bsonType: 'object',
  required: ['experienceId', 'guideId', 'startAt', 'endAt', 'seatsTotal', 'seatsAvailable', 'priceMinor', 'status'],
  properties: {
    seatsTotal: { bsonType: ['int', 'long'], minimum: 1, maximum: 60 },
    seatsAvailable: { bsonType: ['int', 'long'], minimum: 0, maximum: 60 },
    seatsHeld: { bsonType: ['int', 'long'], minimum: 0, maximum: 60 },
    priceMinor: money,
    status: { enum: ['OPEN', 'CLOSED', 'CANCELLED'] },
    startAt: { bsonType: 'date' },
    endAt: { bsonType: 'date' },
  },
};

const bookings = {
  bsonType: 'object',
  required: ['code', 'userId', 'guideId', 'experienceId', 'slotId', 'status', 'seats', 'totalMinor', 'idempotencyKey'],
  properties: {
    code: { bsonType: 'string', maxLength: 20 },
    seats: { bsonType: ['int', 'long'], minimum: 1, maximum: 20 },
    unitPriceMinor: money,
    subtotalMinor: money,
    feeMinor: money,
    taxMinor: money,
    totalMinor: money,
    commissionMinor: money,
    guidePayoutMinor: money,
    currency: { enum: ['INR'] },
    status: {
      enum: [
        'PENDING_PAYMENT',
        'CONFIRMED',
        'CANCELLED_BY_USER',
        'CANCELLED_BY_GUIDE',
        'EXPIRED',
        'COMPLETED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
      ],
    },
    timeline: { bsonType: 'array', maxItems: 40 },
  },
};

const payments = {
  bsonType: 'object',
  required: ['bookingId', 'userId', 'provider', 'providerOrderId', 'amountMinor', 'status'],
  properties: {
    provider: { enum: ['RAZORPAY'] },
    amountMinor: money,
    capturedMinor: money,
    refundedMinor: money,
    status: {
      enum: [
        'CREATED',
        'AUTHORIZED',
        'CAPTURED',
        'FAILED',
        'REFUND_PENDING',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
      ],
    },
    refunds: { bsonType: 'array', maxItems: 20 },
    webhookEvents: { bsonType: 'array', maxItems: 50 },
  },
};

const reviews = {
  bsonType: 'object',
  required: ['targetType', 'targetId', 'userId', 'rating', 'title', 'body', 'status'],
  properties: {
    targetType: { enum: ['PLACE', 'EXPERIENCE'] },
    rating: { bsonType: ['int', 'long'], minimum: 1, maximum: 5 },
    title: { bsonType: 'string', maxLength: 120 },
    body: { bsonType: 'string', maxLength: 4000 },
    imageUrls: { bsonType: 'array', maxItems: 6 },
    crowdFelt: { bsonType: ['double', 'int', 'null'], minimum: 0, maximum: 1 },
    status: { enum: ['PUBLISHED', 'HIDDEN', 'REMOVED'] },
  },
};

const trips = {
  bsonType: 'object',
  required: ['userId', 'title', 'days'],
  properties: {
    title: { bsonType: 'string', minLength: 1, maxLength: 120 },
    travellers: { bsonType: ['int', 'long'], minimum: 1, maximum: 30 },
    days: { bsonType: 'array', maxItems: 30 },
  },
};

/**
 * The weight that keeps popularity a penalty is guarded here too: a direct
 * write cannot set popularityPenalty or crowdPenalty to zero or below.
 */
const recommendationconfigs = {
  bsonType: 'object',
  required: ['name', 'weights', 'params'],
  properties: {
    weights: {
      bsonType: 'object',
      required: ['popularityPenalty', 'crowdPenalty'],
      properties: {
        popularityPenalty: { bsonType: ['double', 'int'], minimum: 0.05, maximum: 5 },
        crowdPenalty: { bsonType: ['double', 'int'], minimum: 0.05, maximum: 5 },
        relevance: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        preferenceMatch: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        quality: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        authenticity: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        localOwnership: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        freshness: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        uniqueness: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
      },
    },
    params: {
      bsonType: 'object',
      properties: {
        minQuality: unit,
        hiddenGemPopularityMax: unit,
        hiddenGemMinQuality: unit,
      },
    },
  },
};

const VALIDATORS = {
  availabilityslots,
  bookings,
  payments,
  reviews,
  trips,
  recommendationconfigs,
};

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

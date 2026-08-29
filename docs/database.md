# Database Design (MongoDB 8 / Mongoose 8)

## 0. Rules

* **Replica set is mandatory** (single-node RS is fine locally) — transactions require it.
* `autoIndex` and `autoCreate` are **false** in every environment. All indexes and all
  `$jsonSchema` validators are applied by `migrate-mongo` migrations.
* Soft delete everywhere via `deletedAt: Date | null`. A global Mongoose query plugin
  injects `deletedAt: null` into every `find*`/`count*`/`update*` unless the query
  explicitly opts out with `.setOptions({ withDeleted: true })`.
* No unbounded arrays. Anything that can grow past a few dozen entries is its own
  collection. No document is allowed near 16 MB.
* Coordinates: GeoJSON `Point`, `[lng, lat]`, `2dsphere` index. `$geoNear` is always the
  first aggregation stage.
* Money: integers in paise (`*Minor`). Never floats.

## 1. Collections

| Collection | Purpose | Growth |
|---|---|---|
| `users` | one collection for all portals | bounded profile + preferences embedded |
| `refreshtokens` | hashed rotating refresh tokens | referenced, TTL indexed |
| `admininvites` | invite-only admin onboarding | referenced, TTL indexed |
| `guideprofiles` | tourist-guide business profile, KYC, payout info | 1:1 with user |
| `places` | discoverable places | embedded images/hours/details + `guideSummary` |
| `destinations` | curated city/region documents | embedded hero content |
| `categories` | taxonomy | small |
| `experiences` | bookable guide-run experiences | embedded `guideSummary`, `placeSummary` |
| `availabilityslots` | per-experience dated slots + seats | referenced, high volume |
| `bookings` | booking records + state machine | referenced |
| `payments` | Razorpay orders/payments/refunds | referenced |
| `reviews` | user reviews of places/experiences | referenced |
| `reviewreports` | abuse reports on reviews | referenced |
| `trips` | trip planner; embedded bounded days/activities | capped 30 days × 20 activities |
| `savedplaces` | user saves | referenced |
| `collections` | user wishlists; holds item refs, capped 200 | referenced |
| `notifications` | in-app notification feed | referenced, TTL 180d |
| `mediaassets` | R2 object metadata | referenced |
| `recommendationconfigs` | tunable ranking weights (only one `active`) | tiny |
| `airequestlogs` | AI prompt/response metadata + validation verdict | referenced, TTL 90d |
| `analyticsevents` | raw interaction events | referenced, TTL 400d |
| `placedailystats` | rolled-up per-place per-day counters | referenced |
| `auditlogs` | admin actions | referenced, append-only |
| `reports` | user complaints / content reports | referenced |
| `outboxevents` | transactional outbox for cross-collection sync | referenced, TTL 7d |

## 2. Key documents

### users
```ts
{
  _id, email (lowercased, unique), emailVerifiedAt, passwordHash,
  role: 'TRAVELLER'|'TOURIST_GUIDE'|'ADMIN'|'SUPER_ADMIN'|'MODERATOR',
  portals: Portal[],                      // portals this account may sign into
  status: 'ACTIVE'|'SUSPENDED'|'PENDING',
  tokenVersion: number,
  totp: { enabled, secretEnc, confirmedAt, recoveryCodeHashes[] } | null,
  profile: { displayName, avatarUrl, bio, phone, city, state, locale },
  preferences: {                          // bounded, drives preferenceMatch
    interests: string[],                   // ≤ 20 category slugs
    travelStyles: string[],                // ≤ 10
    budgetBand: 'LOW'|'MID'|'HIGH',
    crowdTolerance: 0..1,
    prefersLocalOwned: boolean,
    dietary: string[], languages: string[]
  },
  lastLoginAt, createdAt, updatedAt, deletedAt
}
```
Indexes: `{email:1}` unique partial on `deletedAt:null`; `{role:1,status:1}`;
`{'preferences.interests':1}`; `{createdAt:-1}`.

### places
```ts
{
  _id, slug (unique), title, summary, description,
  categorySlugs: string[],                // ≤ 8
  location: { type:'Point', coordinates:[lng,lat] },
  address: { line1, area, city, district, state, pincode, country:'IN' },
  images: [{ key, url, width, height, alt, credit }],   // ≤ 12
  openingHours: [{ day:0..6, opensMin, closesMin, closed }],  // ≤ 7
  details: { entryFeeMinor, bestTimeMonths:number[], durationMin,
             accessibility:string[], amenities:string[], tips:string[] },  // bounded
  signals: {
    qualityScore 0..1, authenticityScore 0..1, localOwnership 0..1,
    uniquenessScore 0..1, popularityScore 0..1, crowdLevel 0..1,
    ratingAvg, ratingCount, saveCount, viewCount, lastVerifiedAt
  },
  discoveryScore: number,                 // precomputed by worker
  ownership: 'LOCAL_OWNED'|'CHAIN'|'GOVERNMENT'|'UNKNOWN',
  guideSummary: GuideSummary | null,      // denormalised, no $lookup on hot path
  destinationId, status:'DRAFT'|'PENDING_REVIEW'|'PUBLISHED'|'REJECTED'|'ARCHIVED',
  moderation: { reviewedBy, reviewedAt, reason },
  createdBy, createdAt, updatedAt, deletedAt
}
```
Indexes: `{location:'2dsphere'}`; `{slug:1}` unique; text index on
`title/summary/description/address.city` with weights; `{status:1,discoveryScore:-1}`;
`{categorySlugs:1,status:1}`; `{'guideSummary.guideId':1,status:1}`;
`{destinationId:1,status:1}`.

### availabilityslots
```ts
{ _id, experienceId, guideId, startAt, endAt, timezone:'Asia/Kolkata',
  seatsTotal, seatsAvailable, priceMinor, currency:'INR',
  status:'OPEN'|'CLOSED'|'CANCELLED', version, createdAt, updatedAt, deletedAt }
```
Indexes: `{experienceId:1,startAt:1}`; `{guideId:1,startAt:1}`;
`{startAt:1,status:1}`; unique `{experienceId:1,startAt:1}` partial on `deletedAt:null`.

### bookings
```ts
{ _id, code (human ref, unique), userId, guideId, experienceId, slotId,
  seats, unitPriceMinor, subtotalMinor, feeMinor, taxMinor, totalMinor,
  commissionMinor, guidePayoutMinor, currency:'INR',
  status:'PENDING_PAYMENT'|'CONFIRMED'|'CANCELLED_BY_USER'|'CANCELLED_BY_GUIDE'
        |'EXPIRED'|'COMPLETED'|'REFUNDED'|'PARTIALLY_REFUNDED',
  paymentId, idempotencyKey (unique), travellerSnapshot, experienceSnapshot,
  timeline:[{status,at,by,reason}],       // ≤ 40
  expiresAt, createdAt, updatedAt, deletedAt }
```

### payments
```ts
{ _id, bookingId, userId, provider:'RAZORPAY', providerOrderId, providerPaymentId,
  providerSignature, amountMinor, currency, status:'CREATED'|'AUTHORIZED'|'CAPTURED'
  |'FAILED'|'REFUND_PENDING'|'REFUNDED'|'PARTIALLY_REFUNDED',
  refunds:[{ providerRefundId, amountMinor, status, reason, at }],  // ≤ 20
  webhookEvents:[{ eventId, type, at }],   // ≤ 50, dedup by eventId
  createdAt, updatedAt, deletedAt }
```

### recommendationconfigs
```ts
{ _id, name, active:boolean, version:number,
  weights: { relevance, preferenceMatch, quality, authenticity, localOwnership,
             freshness, uniqueness, popularityPenalty, crowdPenalty },
  params: { freshnessHalfLifeDays, distanceDecayKm, maxCandidates,
            minQuality, hiddenGemPopularityMax },
  updatedBy, createdAt, updatedAt, deletedAt }
```
Exactly one document may have `active: true` (unique partial index).

## 3. Transactions

Used for: booking creation (+ slot decrement + payment intent), payment capture
(+ booking confirmation + payout accrual), refund, review create (+ place rating
recompute), guide profile rename (+ `guideSummary` fan-out is queued via outbox).

## 4. Migrations

`migrate-mongo` in `backend/migrations`. Each migration is reversible.
Commands (run inside `backend/`): `npm run db:migrate`, `npm run db:migrate:down`,
`npm run db:seed`, `npm run db:reset`.
Seed is idempotent: every seeded document has a deterministic `_id` derived from a
namespace UUID + natural key, and is written with `updateOne(..., { upsert: true })`.

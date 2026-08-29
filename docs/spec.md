# ANVESH — Product & Technical Specification

> **Discover the places maps don't tell you about.**

Anvesh is a local-first travel discovery platform for India. It surfaces offbeat places,
locally-owned businesses, authentic food, homestays, nature spots, cultural experiences
and the tourist guides who run them.

## 1. Core product principle (non-negotiable)

**Popularity is a penalty, not a boost.**

The ranking function must never be "optimised" into a popularity ranker. As a place
becomes more visited and more crowded, its discovery score must go *down*:

```
score =  w_rel  * relevance
       + w_pref * preferenceMatch
       + w_qual * quality
       + w_auth * authenticity
       + w_local* localOwnership
       + w_fresh* freshness
       + w_uniq * uniqueness
       - w_pop  * popularityPenalty
       - w_crowd* crowdPenalty
```

All `w_*` weights live in the `recommendationconfigs` collection and are editable from
the Admin portal. They are **never** hard-coded. A guard test
(`ranking.invariant.spec.ts`) asserts that increasing `popularityScore` with all other
inputs fixed strictly decreases the final score; this test may not be deleted.

## 2. Portals

| # | Portal name | Portal identifier | Path | Code |
|---|-------------|-------------------|------|------|
| 1 | User / Traveller | `TRAVELLER` | `/` | `frontend/src/user` |
| 2 | Tourist Guide | `TOURIST_GUIDE` | `/guide` | `frontend/src/guide` |
| 3 | Admin | `ADMIN` | `/admin` | `frontend/src/admin` |

The second portal is named **Tourist Guide**. It is never called "Partner".

There is one `users` collection. Every access token carries `sub` (userId), `role` and
`portal`. Portal authorisation and role authorisation are **separate checks**. A token
minted for one portal presented to another portal yields `403 PORTAL_MISMATCH`.

Roles: `TRAVELLER`, `TOURIST_GUIDE`, `ADMIN`, `SUPER_ADMIN`, `MODERATOR`.

## 3. Stack (fixed — no substitutions)

**MERN**: MongoDB · Express · React · Node.

npm · Node 20+ · TypeScript strict · React 19 · Vite 7 · React Router 7 ·
Tailwind CSS 4 · Radix UI · TanStack Query · Zustand · Framer Motion ·
MapLibre GL · Express 5 · MongoDB + Mongoose 8 · Razorpay · Resend / SMTP ·
Zod 4 · migrate-mongo · Vitest · Playwright.

Two folders, two `npm install`s, no other tooling. The original build used a
pnpm/Turborepo monorepo with Next.js frontends, Redis + BullMQ for background
work and S3-compatible object storage for media; conflict C10 in
[`spec-conflicts.md`](./spec-conflicts.md) records why each of those went and
what replaced it.

Default AI provider: **Gemini** (behind a provider abstraction).
Default maps provider: **Ola Maps** (behind a provider abstraction).

## 4. Applications

```
backend/     REST API, base /api/v1     Node.js + Express 5 + Mongoose
frontend/    All three portals          React 19 + Vite + React Router
e2e/         Playwright journeys
docs/        This documentation
```

```
backend/src/lib/database    Mongoose models, connection, seed
backend/migrations          migrate-mongo index + validator migrations
backend/src/lib/types       Shared enums, DTO types, error codes (single source)
backend/src/lib/validation  Zod 4 schemas shared by API and client
backend/src/lib/config      Env loading + validation, runtime config
backend/src/lib/shared      Pure utilities (money, geo, slug, score, dates)
backend/src/modules         Routes -> controllers -> services -> repositories
backend/src/jobs            Background jobs, in-process

frontend/src/lib/{types,shared,validation}   The same contract files
frontend/src/ui                              Radix-based design system
frontend/src/{user,guide,admin}              One folder per portal
```

Each portal folder holds a `router.tsx` shim (`Link`, `useRouter`,
`usePathname`, `useSearchParams`) that applies that portal's path prefix, and a
`routes.tsx` that lists its screens. Pages write paths as if their portal owned
the site, so the prefix lives in exactly one file per portal.

## 5. API contract

Base path `/api/v1`. Every response uses one envelope.

```jsonc
// success
{ "success": true, "data": { }, "meta": { "requestId": "..." } }
// error
{ "success": false, "error": { "code": "...", "message": "...", "details": { } },
  "meta": { "requestId": "..." } }
```

* Error codes exist **only** in `backend/src/lib/types/error-codes.ts` (copied
  verbatim to `frontend/src/lib/types` so the client cannot invent its own).
* Every request carries `X-Request-Id` (generated if absent) and it appears in every
  structured log line. PII is never logged.
* Money is always an integer in minor units: `priceMinor`, `amountMinor`,
  `commissionMinor`, `refundMinor`. Floats are forbidden for money.
* Coordinates are GeoJSON `{ type: "Point", coordinates: [lng, lat] }` — **longitude first**.

## 6. Security baseline

JWT access + rotating refresh tokens (hashed, stored, revocable) · argon2id password
hashing · `JwtGuard` → `PortalGuard` → `RolesGuard` → service-level ownership check →
query-level scoping · NoSQL-injection sanitisation (reject keys starting with `$` or
containing `.`) · Zod validation of body/query/params/AI output · Helmet · strict CORS
allowlist · double-submit CSRF for cookie flows · Razorpay webhook HMAC verification ·
upload MIME + magic-byte + size validation · per-route rate limits · admin invite-only
with mandatory TOTP and full audit logging.

Guards alone are never sufficient: every owned resource is additionally fetched with an
ownership predicate baked into the Mongo filter.

## 7. Data model summary

Embed what is bounded and read together; reference what grows without bound.

* **Embedded**: place details/images/hours/location, trip days + activities, user
  profile + preferences, denormalised `guideSummary` / `placeSummary`.
* **Referenced**: reviews, bookings, slots, payments, notifications, audit logs,
  analytics events, AI request logs, refresh tokens, media assets.

Soft delete via `deletedAt` everywhere, enforced by Mongoose query middleware.
All indexes are created by `migrate-mongo` migrations; `autoIndex` is off in every
environment. Every collection has a `$jsonSchema` validator applied by migration.

## 8. Booking concurrency

Seat availability is decremented with a single atomic conditional update:

```ts
slots.findOneAndUpdate(
  { _id, deletedAt: null, seatsAvailable: { $gte: seats }, status: 'OPEN' },
  { $inc: { seatsAvailable: -seats } },
  { new: true },
)
```

`null` result ⇒ `SLOT_SOLD_OUT`. No application-level locks. Booking + payment intent
creation happens inside a MongoDB transaction (hence the mandatory replica set).

## 9. AI safety rule

The LLM may never invent a place. Every structured AI response is (1) parsed with a Zod
schema, (2) checked so that every referenced `placeId` / `experienceId` exists and is
published in MongoDB, and only then (3) returned or persisted. A response referencing an
unknown id is rejected with `AI_HALLUCINATED_REFERENCE` and never reaches the user.

## 10. Phases

Phases 0–15 as defined in the build prompt; progress tracked in `TODO.md`.

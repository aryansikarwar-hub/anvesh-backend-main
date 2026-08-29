# Anvesh — Backend

**Discover the places maps don't tell you about.**

A local-first travel discovery platform for India, built around one inverted
idea: **popularity is a penalty, not a boost.** Most travel products rank by
what everyone already visits. Anvesh ranks *against* it — the more popular and
the more crowded a place is, the lower it scores — so what surfaces is the
quiet waterfall two valleys over, not the one with a car park.

This folder is the API: **Node.js + Express 5 + TypeScript + MongoDB**. It is
self-contained — everything it needs to run is in this folder. The web app
that talks to it lives in the sibling `frontend/` folder (a separate
deployable service; see its own README).

---

## Start here

```bash
cp .env.example .env          # put your MongoDB connection string in it
npm install
npm run db:migrate            # create collections, indexes, validators
npm run db:seed               # 40 real Indian places and demo accounts
npm run dev                   # http://localhost:4000
```

You need **Node 20+** and a **MongoDB** — a free
[Atlas](https://www.mongodb.com/cloud/atlas) cluster is the easiest option and
installs nothing. [`docs/setup.md`](./docs/setup.md) walks through it,
including what to do about transactions on a local `mongod`.

| Where | URL |
| --- | --- |
| API | http://localhost:4000/api/v1 |
| API docs (Swagger UI) | http://localhost:4000/api/v1/docs |

Seed accounts all use the password `Anvesh@Dev2026`:
`aarav.mehta@example.in` (traveller), `shreya.kodagu@example.in` (guide),
`root@anvesh.travel` (super admin — enrols TOTP on first sign-in).

---

## Read this before anything else

### 1. What is stubbed, and where

Here is the complete list. Nothing else in this repository is simulated.

| Feature | Without a key | With a key |
| --- | --- | --- |
| **AI (trip planning, "why this place", natural-language search)** | `AI_PROVIDER=stub` runs a **deterministic, database-backed** provider. It does **not** invent places: it selects and ranks documents that already exist in MongoDB. Every response carries `provider: "stub"` and `degraded: true`. **Production refuses to boot with `AI_PROVIDER=stub`.** | `AI_PROVIDER=gemini` + `GEMINI_API_KEY` calls the real Gemini REST API. |
| **Payments (Razorpay)** | Every payment endpoint returns `503 PAYMENT_PROVIDER_NOT_CONFIGURED`. No booking is ever confirmed, no order row is written, nothing is faked. | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` enable real orders, real HMAC verification and real refunds. |
| **Maps** | `MAPS_PROVIDER=maplibre-demo` — coordinates are real, tiles are OpenStreetMap. | `MAPS_PROVIDER=ola` + `OLA_MAPS_API_KEY` enables Ola tiles, geocoding and directions. |
| **Email** | `EMAIL_PROVIDER=console` writes the message to the server log and sends nothing. `smtp` sends through any SMTP server you point it at. | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`. |
| **Media storage** | Uploads are written to `backend/uploads/` and served from `/uploads`. Real files, local disk. | See the storage note in [`docs/deployment.md`](./docs/deployment.md) before running this in production. |
| **Photographs** | There are none, and none are invented. A place shows a photo only after a guide uploads one; until then its card carries a cover generated from its own slug — deterministic. | Guides upload real images through the media flow. |
| **Seed data** | `npm run db:seed` inserts 40 real Indian places, 6 local stories, 13 experiences, 6 guides, 6 travellers and 2 admin accounts. No bookings and no payments are seeded. Refuses to run when `NODE_ENV=production`. | — |

There is no fake dashboard number, no fake booking, no fake review, no fake
notification and no fake search result anywhere in the codebase.

### 2. What has and has not been run

This repository was built and converted inside a sandbox that could not obtain
a `mongod` binary. `npm run typecheck` and `npm test` (148 unit tests) were
really run here; `npm run db:migrate`, `npm run db:seed` and
`npm run test:integration` are written but need a real MongoDB you provide.
See [`TODO.md`](./TODO.md) for the full, honest breakdown.

---

## The product rule

`src/lib/shared/ranking/score.ts` is a pure function:

```
score = ( relevance + preferenceMatch + quality + authenticity
        + localOwnership + freshness + uniqueness )
      - ( popularityPenalty × popularity )
      - ( crowdPenalty     × crowd )
```

Both penalties **subtract**. Every weight lives in the `recommendationconfigs`
collection and is editable by an admin at `/admin/recommendations` — none is
hard-coded. `ranking.invariant.spec.ts` asserts that raising popularity or
crowding strictly lowers the score. The search API exposes sorts for
`recommended`, `nearest`, `rating`, `newest` and `quietest` — there is
deliberately no way to sort by popularity.

---

## Three portals, one API

One `users` collection. The JWT carries `userId`, `role` **and** `portal`, and
portal and role are checked **separately**: a token minted for the traveller
portal is rejected on the guide API with `403 PORTAL_MISMATCH` even when the
account's role would allow it. Ownership is a third, independent layer, baked
into the Mongo query filter rather than left to a guard — Guide A asking for
Guide B's place gets `404`, not a leak. Admin access is invite-only with
mandatory TOTP and full audit logging.

---

## Stack

| Layer | Choice |
| --- | --- |
| Tooling | npm, Node 20+, TypeScript 5.9 strict |
| API | Node.js + Express 5, Zod 4, layered router → validate → guards → service → repository |
| Background jobs | In the API process: fire-and-forget dispatch with retries, plus two schedulers |
| Data | MongoDB + Mongoose 8. A replica set is strongly preferred — see below |
| Media | Local disk under `UPLOAD_DIR`, served from `/uploads` |
| Payments / AI / Maps / Email | Razorpay, Gemini, Ola Maps, Resend or SMTP — all behind provider interfaces |
| Migrations | migrate-mongo. `autoIndex` is off everywhere; **every index is a migration** |

```
src/          Express app, Mongoose models, modules, jobs, infra
migrations/   migrate-mongo migrations
test/         unit + integration specs
docs/         spec, architecture, database, security, setup, deployment,
              testing, api, openapi.json, spec-conflicts
scripts/      check-secrets
```

### About MongoDB transactions

Booking and payment write to several collections at once and use transactions
so those writes either all land or none do. Transactions need a **replica
set** — Atlas gives you one; a plain local `mongod` does not. The API detects
this at startup, warns, and runs the same code without the transaction.
Everything works; those two flows just lose their all-or-nothing guarantee.
Fine for development, not for a live deployment.

---

## Conventions that are enforced, not merely intended

* **Money is always an integer in minor units** (`priceMinor`, `amountMinor`,
  `totalMinor`). `assertMinor()` throws on a float. No `Number` rupees anywhere.
* **Every error code lives in `src/lib/types/error-codes.ts`** — 100 of them,
  one source of truth, with an explicit HTTP status map and a test that fails
  if a code has no status.
* **Every response is an envelope** with `meta.requestId`. `X-Request-Id` is on
  every request and every log line. **No PII is logged** — not emails, not
  names, not tokens.
* **Booking concurrency is one atomic `findOneAndUpdate`** with
  `seatsAvailable: { $gte: n }` and `$inc`. There is no application-level lock
  anywhere in the codebase.
* **The LLM can never invent a place.** Model output is parsed, Zod-validated,
  and then every referenced `placeId` / `experienceId` is looked up in MongoDB
  and confirmed `PUBLISHED`. Anything unresolved is rejected with
  `AI_HALLUCINATED_REFERENCE` and recorded for admin review.
* **OpenAPI is generated from the live Express router** (104 paths) and two
  parity tests fail if the document and the router drift apart in either
  direction.
* **Nothing secret is committed.** `npm run check:secrets` scans for it.

---

## Commands

```bash
npm run dev              # tsx watch, port 4000
npm run build            # tsc -> dist/
npm start                # node dist/main.js
npm run typecheck
npm test                 # 148 unit tests, no database needed
npm run test:integration # boots the real app against an in-memory MongoDB
npm run db:migrate       # migrate-mongo up
npm run db:seed          # real Indian seed data; refuses NODE_ENV=production
npm run db:reset         # wipe and reseed
npm run openapi          # regenerate docs/openapi.json from the live router
npm run check:secrets    # fail if anything that looks like a real credential is committed
```

---

## Documentation

| File | What it covers |
| --- | --- |
| [`docs/setup.md`](./docs/setup.md) | Local development from a clean machine — start here |
| [`docs/spec.md`](./docs/spec.md) | The product specification as built |
| [`docs/architecture.md`](./docs/architecture.md) | Module boundaries, request lifecycle, background jobs |
| [`docs/database.md`](./docs/database.md) | Every collection, index and validator, and why each field is embedded or referenced |
| [`docs/security.md`](./docs/security.md) | Auth, the three authorization layers, rate limiting, injection defence |
| [`docs/testing.md`](./docs/testing.md) | How to run every suite, including what needs what |
| [`docs/deployment.md`](./docs/deployment.md) | Production topology, env vars, rollout — **read the scaling and storage notes** |
| [`docs/api.md`](./docs/api.md) | Envelope, errors, pagination, idempotency, webhooks |
| [`docs/openapi.json`](./docs/openapi.json) | Generated from the live router |
| [`docs/spec-conflicts.md`](./docs/spec-conflicts.md) | Every deviation from the brief, C1–C11 |
| [`TODO.md`](./TODO.md) | What is written but not yet executed |

---

## Licence

Unlicensed / private. India-focused, built for `anvesh.travel`.
#   a n v e s h - b a c k e n d - m a i n  
 
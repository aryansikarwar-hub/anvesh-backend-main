# Testing

Four layers, each with a different prerequisite. This document says exactly what
each one needs and — honestly — which of them have been run in the environment
this repository was built in.

| Layer | Command (from) | Needs | Run? |
| --- | --- | --- | --- |
| Unit | `npm test` (`backend/`) | nothing | **yes — 148 passing** |
| Integration | `npm run test:integration` (`backend/`) | a `mongod` binary (replica set) | **no** — see [`../TODO.md`](../TODO.md) |
| End-to-end | `npm run test:e2e` (`e2e/`) | the full stack running | **no** |
| Static | `npm run typecheck` (both) | nothing | **yes — both clean** |
| Frontend build | `npm run build` (`frontend/`) | nothing | **yes — all 62 routes render** |

No output in this repository is fabricated. Anything that was not run is
reported as not run.

---

## Unit tests

```bash
cd backend && npm test
```

Pure logic only — no database, no network, no clock dependence.

| Package | Tests | What matters most |
| --- | --- | --- |
| `@anvesh/shared` | 36 | **the ranking invariant** |
| `@anvesh/api` | 73 | middleware chain, AI guardrails, Razorpay HMAC, pricing, OpenAPI parity |
| `@anvesh/validation` | 18 | Zod schemas accept what they must and reject what they must |
| `@anvesh/database` | 11 | schema construction, soft-delete plugin, money validators |
| `@anvesh/config` | 7 | env parsing, production refusals |
| `@anvesh/types` | 3 | every error code has an HTTP status |

### The one test that must never be weakened

`backend/src/lib/shared/ranking/ranking.invariant.spec.ts` asserts that raising
popularity or crowding **strictly lowers** a candidate's score, across the whole
`[0, 1]` range and for every weight configuration it tries. It carries a comment
saying so. If a future change makes popularity a boost, this test fails — which
is the entire point of it existing.

`backend/src/openapi/openapi.spec.ts` is the other structural one: it fails if
the OpenAPI document documents a route that is not served, or serves a route
that is not documented.

---

## Integration tests

```bash
cd backend && npm run test:integration
```

These boot the **real** Express application — the real container, the real
middleware chain, the real routers — against an in-memory MongoDB replica set,
and apply the **real** `migrate-mongo` migrations, so the indexes and
`$jsonSchema` validators under test are the ones production gets. Rate limiting
is disabled; nothing else is stubbed.

`backend/test/global-setup.ts` starts `MongoMemoryReplSet`, which downloads a
`mongod` binary on first run. If your network cannot reach
`fastdl.mongodb.org`, point it at a local server instead:

```bash
MONGOMS_SYSTEM_BINARY=$(which mongod) npm run test:integration
```

| Spec | What it proves |
| --- | --- |
| `auth.integration.spec.ts` | Passwords are hashed with argon2id and never returned. Duplicate registration is generic. A `role` in the request body is ignored. Refresh tokens rotate, and **reusing an old one kills the whole family**. Changing a password revokes every session. An admin can never get a session from `/auth/login`. |
| `authorization.integration.spec.ts` | `PORTAL_MISMATCH` in all three directions, including for a user whose *role* would allow the call. `ROLE_NOT_ALLOWED` for a forged portal claim. A `MODERATOR` can moderate but cannot manage users. **Guide A cannot read, edit or delete Guide B's place** — the query is scoped, so the answer is `404`. A `guideId` in the body is rejected. |
| `booking-concurrency.integration.spec.ts` | Ten travellers race for one seat → exactly one `201`, nine `SLOT_SOLD_OUT`. Twenty race for five → exactly five. A two-seat request is never partially filled. Idempotency keys replay safely and cannot be reused across users. Past and closed slots are refused. |
| `discovery.integration.spec.ts` | With everything else held equal, the less popular place ranks higher; so does the less crowded one; quality can still win. `sort=popular` is a validation error. Unpublished and soft-deleted places never appear. `$geoNear` distance and bounding-box filtering are correct. |
| `payments.integration.spec.ts` | An unconfigured provider returns `503` and **writes nothing**. A forged checkout signature fails and leaves the booking `PENDING_PAYMENT`. A correctly-signed webhook confirms a booking the browser never came back for; a tampered body, a replayed delivery and a mismatched amount all do not. |

### Writing another one

`backend/test/harness.ts` gives you `startHarness`, `resetDatabase`,
`createUser`, `accessToken` and `bearer`; `fixtures.ts` gives you
`seedRankingConfig`, `createPlace`, `createExperience` and `createSlot`. Call
`resetDatabase()` in `beforeEach` — it truncates collections but leaves indexes
and validators in place, so it is fast and still realistic.

---

## End-to-end tests

```bash
cd backend  && npm run db:migrate && npm run db:seed
cd backend  && npm run dev        # leave running
cd frontend && npm run dev        # leave running, another shell
cd e2e      && npm install && npx playwright install && npm run test:e2e
```

Playwright drives the three real portals against the real API. They are route
prefixes in one app now — `/`, `/guide`, `/admin` on port 5173 — and
`e2e/support/env.ts` is where those URLs are set. The config
deliberately does **not** spawn the stack itself, so a failure here is a failure
of the application rather than of a fixture.

| Spec | Journey |
| --- | --- |
| `e2e/traveller.e2e.ts` | register → verify email (read out of a mail catcher; skipped when none is reachable) → login → search → view a place → save → create a trip → book → checkout → bookings list → blocked from the guide and admin portals |
| `e2e/guide.e2e.ts` | login → create a place → edit it → submit for review (and confirm the guide **cannot** publish it itself) → add availability → bookings → earnings → blocked from admin |
| `e2e/admin.e2e.ts` | password alone yields a challenge, not a session → wrong TOTP rejected → real TOTP accepted → moderate → verify a guide → inspect a booking (with no "mark as paid" anywhere) → ranking config → audit log → AI monitoring |

### The admin TOTP secret

The second factor is never bypassed. The seed does not fabricate a TOTP secret,
so before the admin specs can run you must enrol one once by hand:

1. Sign in at http://localhost:5173/admin/login as `root@anvesh.travel`.
2. The challenge screen shows an `otpauth://` URL. Take the `secret=` parameter
   out of it (and save the recovery codes).
3. Export it: `export E2E_ADMIN_TOTP_SECRET=<that base32 secret>`.

Without it the admin specs `test.skip` themselves with a message pointing here,
rather than pretending the second factor was satisfied.

### Overriding targets

`E2E_WEB_URL`, `E2E_GUIDE_URL`, `E2E_ADMIN_URL`, `E2E_API_URL`,
`E2E_MAILPIT_URL` and the `E2E_*_EMAIL` / `E2E_*_PASSWORD` pairs all override
the defaults, so the same suite runs against a preview deployment.

---

## What is deliberately not tested

- **Load and performance.** No throughput or latency number is claimed anywhere
  in this repository.
- **A live Razorpay transaction.** The HMAC verification that protects it is
  pure crypto and *is* unit-tested, offline, with no key.
- **A live Gemini call.** The guardrail pipeline around it — parse, Zod
  validate, resolve every referenced id against MongoDB, reject with
  `AI_HALLUCINATED_REFERENCE` — is unit-tested with recorded model output,
  including deliberately hallucinated ids.

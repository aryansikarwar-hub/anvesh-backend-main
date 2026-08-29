# TODO — what is written but not yet executed

Everything below is code that is committed and type-checked, but that **could
not be run** in the sandbox this repository was built and converted in. Nothing
here has been reported as passing.

---

## 1. The blocker: no `mongod` binary is obtainable in the build sandbox

Booking and payment use multi-document transactions, which need MongoDB as a
**replica set**. The build environment has npm, PyPI and the Ubuntu archive
reachable, but every route to a MongoDB server binary is blocked:

| Source | Result |
| --- | --- |
| `https://fastdl.mongodb.org/...` | `403` at the proxy (verified) |
| `https://downloads.mongodb.org`, `repo.mongodb.org` | blocked |
| Docker Hub, `ghcr.io`, `quay.io`, `gcr.io` | blocked |
| `apt-get install mongodb-server` | *"Package 'mongodb-server' has no installation candidate"* |
| `mongodb-memory-server` | downloads from `fastdl.mongodb.org` at runtime — same `403` |

Real output from `npm run test:integration` in `backend/`:

```
⎯⎯⎯⎯⎯⎯ Unhandled Error ⎯⎯⎯⎯⎯⎯⎯
Error: Download failed for url "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.24.tgz", Details:
Status Code is 403 (MongoDB's 404)
 ❯ RedirectableRequest.<anonymous> node_modules/mongodb-memory-server-core/lib/util/MongoBinaryDownload.js:351:32
```

Everything in section 3 follows from this one fact.

---

## 2. What *was* really executed

So the line between the two is clear:

| Check | Result |
| --- | --- |
| `npm run typecheck` — `backend/` | clean |
| `npm test` — `backend/` | **148 passing**, 13 files |
| `npm run build` — `backend/` | clean `tsc` emit to `dist/` |
| `npm run typecheck` — `frontend/` | clean |
| `npm run build` — `frontend/` | 2111 modules, production bundle built |
| `npm run typecheck` — `e2e/` | clean |
| Playwright route pass | **71/71 routes** across all three portals mounted and rendered, with titles |
| Playwright navigation pass | in-portal links, cross-portal links, active-nav state, and the `?next=` sign-in return path all correct |
| Express app smoke run | container wiring, 104 documented routes, envelope + `requestId`, 404 and Zod-validation paths |
| Media flow smoke run | approve → PUT bytes → served from `/uploads`; wrong size rejected; tampered token rejected |
| Background jobs smoke run | dispatch and schedulers run with no queue server present |

---

## 3. Written, never executed

### 3.1 API integration suite — `backend/test/`

Boots the **real** Express app against an in-memory replica set and applies the
**real** `migrate-mongo` migrations, so indexes and `$jsonSchema` validators are
the ones production gets.

| File | Covers |
| --- | --- |
| `auth.integration.spec.ts` | registration hashing, duplicate email, role-injection rejection, portal scoping, generic auth errors, admins never sessioned via `/auth/login`, suspended accounts, refresh-token reuse detection, password change revoking sessions, `AUTH_EMAIL_NOT_VERIFIED` gate on booking |
| `authorization.integration.spec.ts` | `PORTAL_MISMATCH` in all three directions, `ROLE_NOT_ALLOWED`, MODERATOR vs ADMIN separation, Guide A cannot read/edit/delete Guide B's place, body-supplied `guideId` rejected, one traveller cannot read another's booking |
| `booking-concurrency.integration.spec.ts` | 10 travellers race for 1 seat → exactly 1 × `201`, 9 × `SLOT_SOLD_OUT`; 20 race for 5 → exactly 5; multi-seat requests never partially fill; idempotency-key replay and cross-user reuse; past and closed slots |
| `discovery.integration.spec.ts` | popularity penalty, crowd penalty, quality still able to win, no `sort=popular`, `quietest` sort, hidden gems, unpublished/soft-deleted exclusion, `$geoNear` distance, bounding box, coordinate validation |
| `payments.integration.spec.ts` | unconfigured provider returns `503` and writes nothing, cross-user order/verify blocked, forged checkout signature → `PAYMENT_SIGNATURE_INVALID` and booking stays `PENDING_PAYMENT`, webhook signature/tamper/replay/amount-mismatch handling |

**To run them** (on any machine that can reach `fastdl.mongodb.org`, or with a
local `mongod` on `$PATH`):

```bash
cd backend && npm run test:integration
# or, with a mongod you already have:
MONGOMS_SYSTEM_BINARY=$(which mongod) npm run test:integration
```

### 3.2 End-to-end suite — `e2e/`

Playwright specs for the three journeys: traveller (register → verify → login →
search → view → save → trip → book → checkout), tourist guide (login → create
place → edit → submit → availability → bookings), and admin (login **with
mandatory TOTP** → moderate → manage a guide → booking → ranking config → audit
log).

These drive the real UI against a real stack with seeded data, so they need
MongoDB. The URLs were updated for the single-app layout
(`e2e/support/env.ts`), but **the specs have not been run since that change** —
expect some assertions to need adjusting, particularly the ones that assert a
redirect to `/login`, since gated pages render an in-page "Sign in to continue"
prompt rather than redirecting.

The admin specs `test.skip` themselves unless `E2E_ADMIN_TOTP_SECRET` is set.
The second factor is never bypassed — a real code is computed with `otplib`.
The traveller registration spec skips itself unless a mail catcher is reachable.

### 3.3 Database migrations and seed

`npm run db:migrate` and `npm run db:seed` are written (8 migrations; 40 real
Indian places across four regions, 6 local stories, 13 experiences, 6 guides,
6 travellers, 2 admins, plus categories and destinations) but have never been
executed against a live server. The seed deliberately creates **no bookings and no payments** —
those must come from the real flow.

Consequences that are therefore unverified in practice, though the code paths
are unit-tested:

* index creation actually succeeding on a live server
* `$jsonSchema` validators rejecting the documents they are meant to reject
* `$geoNear` returning `distanceKm` on real 2dsphere indexes
* transaction commit/abort on a real replica set, **and** the new non-transactional
  fallback path on a standalone `mongod`

### 3.4 Not attempted at all

* **Load/performance testing.** No numbers are claimed anywhere.
* **A real Razorpay transaction.** Signature verification is pure crypto and
  *is* unit-tested; order creation, capture and refund require live keys.
* **A real Gemini call.** The provider is written against the real REST API;
  `AI_PROVIDER=gemini` has never been exercised with a key.
* **Ola Maps tiles.** The map degrades to a documented coordinate readout
  without `OLA_MAPS_API_KEY`.
* **Deployment.** `docs/deployment.md` describes the intended topology; nothing
  has been deployed.
* **The Stories flow end to end.** The model, migration, validator, API, guide
  editor and admin queue are all written and type-check, and six stories are in
  the seed — but no story has been written, submitted, moderated or read against
  a live database, because that needs MongoDB. Its migration
  (`20260101000700-stories.js`) has never been applied.
* **An exact colour match to the Raahi prototype.** Its stylesheet was not
  reachable through the tooling available here, so the palette was matched from
  a description of the rendered page. If the shade matters, send screenshots and
  the token values in `frontend/src/ui/styles/theme.css` are a single-file
  change.

---

## 4. Known trade-offs introduced by the MERN conversion

These are working as designed, not bugs, but they are real and they are yours
to accept or undo. Full reasoning in `docs/spec-conflicts.md` C10 and the notes
in `docs/deployment.md`.

* **Rate limits are per API process.** They were in Redis, shared across
  instances. Behind N API instances the effective limit is now N × the policy.
* **Background jobs run in the API process.** Work in flight is lost if the
  process dies, and the schedulers would fire once per instance. `EXPIRE_BOOKINGS`
  — the one that returns held seats — is a sweep, so a missed run is repaired by
  the next one five minutes later rather than lost.
* **Uploads are on the API server's disk.** A container filesystem loses them on
  redeploy. Mount a persistent volume, or put
  `backend/src/infra/storage/local.storage.ts` back on object storage — it is one
  class with four methods and `MediaService` does not care which.
* **A standalone `mongod` gives up transaction atomicity.** The API warns at
  startup. Use a replica set for anything real.

---

## 5. Deviations from the original brief

Recorded in full in `docs/spec-conflicts.md` (C1–C11). The ones worth repeating:

* **C8 — NestJS 11 → Node.js + Express 5**, on explicit instruction mid-build.
  The prescribed layering (router → validate → guards → service → repository →
  MongoDB) is preserved with explicit middleware and constructor injection in
  `backend/src/container.ts`.
* **C11 / C12 — the Raahi UI.** The design system was re-skinned rather than
  replaced, Raahi's navigation, card anatomy, filters and dashboards were
  adopted, and its Local Stories feature was built end to end. Figures Raahi
  showed that Anvesh cannot compute were left out rather than faked.
* **C10 — the MERN conversion.** pnpm/Turborepo → npm; three Next.js apps → one
  React + Vite SPA with `/`, `/guide` and `/admin`; Redis + BullMQ + worker → in-process
  jobs; MinIO/R2 → local disk. Business logic, data model and API surface unchanged.
* **C9 — Google Fonts** are unreachable from the sandbox, so web fonts were
  removed and the display/sans stacks are system fonts assigned to
  `--font-anvesh-sans` / `--font-anvesh-display` in
  `frontend/src/styles/index.css`.

---

## 6. What to do first on a machine with MongoDB

Run from this folder (`backend/`); `frontend/` is expected to be its sibling.

```bash
cp .env.example .env          # put your MONGODB_URI and three secrets in it
npm install
npm run db:migrate && npm run db:seed
npm test
npm run test:integration      # section 3.1

cd ../frontend
cp .env.example .env.local
npm install
npm run build

# then, with both dev servers running:
cd e2e && npm install && npx playwright install && npm run test:e2e   # section 3.2
```

If any of the above fails, that is a real failure and should be treated as one.
Nothing in this repository has been made to pass by weakening an assertion.

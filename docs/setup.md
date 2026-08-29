# Setup

From a clean machine to a running Anvesh in about ten minutes.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node | 20.x or newer (22 recommended) | Runs both halves of the project |
| npm | comes with Node | The only package manager used here |
| MongoDB | 6.0+ | The database. Cloud (Atlas) or local — see below |

Nothing else. No Docker, no Redis, no object storage and no separate worker
process — those were removed in favour of things that run with `npm` alone.

### Getting a MongoDB

**Option A — MongoDB Atlas (recommended, nothing to install).**
Create a free M0 cluster at <https://www.mongodb.com/cloud/atlas>, add a
database user, allow your IP under Network Access, and copy the connection
string. It looks like:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/anvesh
```

**Option B — MongoDB Community Server on your machine.**
Install it from <https://www.mongodb.com/try/download/community> and use:

```
mongodb://127.0.0.1:27017/anvesh
```

### One note about transactions

Booking and payment write to several collections at once and use MongoDB
transactions so those writes either all land or none do. Transactions need a
**replica set**.

* Atlas clusters are replica sets already — nothing to do.
* A plain local `mongod` is not. The API detects this at startup, prints a
  warning, and runs the same code without the transaction. Everything works;
  those two flows just lose their all-or-nothing guarantee. Fine for
  development, not for a live deployment.

To make a local install a replica set, start it with `mongod --replSet rs0`
and run `rs.initiate()` once in `mongosh`.

## 1. Backend environment

```bash
cd backend
cp .env.example .env
```

Fill in, at minimum, your `MONGODB_URI` and three secrets:

```bash
# Print three different random values and paste them in
node -e "for(let i=0;i<3;i++)console.log(require('crypto').randomBytes(48).toString('base64'))"
```

They go in `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and
`TOTP_ENCRYPTION_KEY`, and they must differ from one another.

Everything else in `.env.example` has a working local default.
`backend/src/lib/config` parses and validates the whole environment at boot — a
missing or malformed value stops the process with a readable message rather
than failing later inside a request.

Provider keys (`RAZORPAY_*`, `GEMINI_API_KEY`, `OLA_MAPS_API_KEY`,
`RESEND_API_KEY`) are optional. What happens without each is listed in the
README table; nothing is faked in their absence.

`.env` is gitignored. Run `node scripts/check-secrets.mjs` from the project
root before committing.

## 2. Install, migrate, seed

```bash
cd backend
npm install
npm run db:migrate     # creates collections, indexes and $jsonSchema validators
npm run db:seed        # real Indian development data
```

`db:migrate` is the only thing that creates indexes — `autoIndex` is off in
every model, deliberately, so index changes are reviewable migrations rather
than a side effect of a deploy.

`db:seed` is idempotent (deterministic ids + upserts) and refuses to run when
`NODE_ENV=production`. It seeds places, experiences, guides, travellers,
categories, destinations and the ranking config — and deliberately **no
bookings and no payments**, because those must come from the real flow.

Seed accounts all use the password `Anvesh@Dev2026`:

| Account | Portal |
| --- | --- |
| `aarav.mehta@example.in` | Traveller |
| `shreya.kodagu@example.in` | Tourist Guide (also has traveller access) |
| `root@anvesh.travel` | Admin — `SUPER_ADMIN` |
| `moderator@anvesh.travel` | Admin — `MODERATOR` |

The admin accounts have **no TOTP secret seeded** — the seed never fabricates
one. The first sign-in returns a `TOTP_ENROLMENT_REQUIRED` challenge with an
`otpauth://` URL and one-time recovery codes; scan it into an authenticator app
and complete the enrolment.

## 3. Frontend environment

```bash
cd frontend
cp .env.example .env
npm install
```

The default `VITE_API_BASE_URL=http://localhost:4000/api/v1` matches the
backend's default port, so usually there is nothing to change.

## 4. Run

Two terminals:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

Or, from the project root, `npm install && npm run dev` runs both at once.

| What | URL |
| --- | --- |
| Traveller portal | http://localhost:5173 |
| Tourist Guide portal | http://localhost:5173/guide |
| Admin portal | http://localhost:5173/admin |
| API | http://localhost:4000/api/v1 |
| Swagger UI | http://localhost:4000/api/v1/docs |
| Uploaded images | http://localhost:4000/uploads/… |

All three portals are one React app. Each has its own sign-in page and its own
session — signing in as a traveller does not sign you in as a guide.

Background jobs (booking expiry, the nightly ranking refresh, guide summary
sync, emails) run inside the API process. There is no worker to start.

## 5. Verify

```bash
cd backend  && npm run typecheck && npm test
cd frontend && npm run typecheck && npm run build
```

The API's integration suite needs a MongoDB binary that it downloads on first
run:

```bash
cd backend && npm run test:integration
```

See [`testing.md`](./testing.md) for the end-to-end suite and what each suite
needs.

## Regenerating the OpenAPI document

```bash
cd backend && npm run openapi     # rewrites docs/openapi.json
```

The document is built by walking the live Express router, and two tests fail if
the router and the document disagree in either direction, so it cannot silently
drift.

## Troubleshooting

**`MongoServerError: ... Transaction numbers are only allowed on a replica
set`** — you are on a standalone `mongod` and something bypassed the fallback.
Use Atlas, or start `mongod --replSet rs0` and run `rs.initiate()` once.

**`MongooseServerSelectionError`** — the API cannot reach MongoDB. Check
`MONGODB_URI`, and on Atlas check that your IP is allowed under Network Access.

**CORS errors in the browser console** — the frontend is on an origin the API
does not allow. Add it to `CORS_ORIGINS` in `backend/.env`.

**Images upload but do not appear.** They are written to `backend/uploads/` and
served from `/uploads`. Check `UPLOAD_DIR`, and that `API_BASE_URL` matches the
address the browser actually uses.

**Fonts look like system fonts.** They are. Web fonts were removed because the
build sandbox could not reach `fonts.googleapis.com`. Assign a real face to
`--font-anvesh-sans` / `--font-anvesh-display` in
`frontend/src/styles/index.css` to change it.

**Payments return 503.** Expected without Razorpay keys. That is the honest
failure, not a bug.

# Deployment

This describes the intended production topology and the procedure to reach it.
**Nothing here has been deployed** — see [`../TODO.md`](../TODO.md). Treat it as
a plan to execute and verify, not as a record of a working deployment.

## Topology

| Component | Runs as | Notes |
| --- | --- | --- |
| `frontend` | Static files (`npm run build` → `dist/`) | Any static host: Netlify, Vercel, Cloudflare Pages, Nginx. **Needs SPA rewrites** — see below |
| `backend` | Node 20+, `node dist/main.js` | `api.anvesh.travel`. See the scaling note |
| MongoDB | **replica set** (Atlas M10+ or self-managed 3-node) | non-negotiable: transactions |
| Uploads | A writable disk mounted at `UPLOAD_DIR` | See the storage note |

The browser never talks to MongoDB. Every read and write goes through the API,
which is the only component holding database credentials.

**SPA rewrites.** The frontend is a single-page app with client-side routing, so
every path must serve `index.html` or a refresh on `/guide/bookings` returns
404. Netlify: `/* /index.html 200`. Vercel: a rewrite of `/(.*)` to `/index.html`.
Nginx: `try_files $uri $uri/ /index.html;`.

**A note on scaling.** Two things now live inside the API process that used to be
separate services, and both assume a single instance:

* Rate limit counters are in process memory, so behind N instances the effective
  limit is N times what the policy says.
* Background jobs run in process, and the schedulers would fire once per
  instance.

Run one API instance, or restore a shared store (Redis for the limiter, a real
queue behind `QueuePublisher`) before running more than one. This is a
deliberate trade for a project that must run without extra infrastructure — do
not discover it in production.

**A note on uploads.** Images are written to `UPLOAD_DIR` on the API server and
served from `/uploads`. That means a real, persistent, backed-up disk — not a
container's ephemeral filesystem, which loses every upload on redeploy. For
anything serious, put `FileStorage` (`src/infra/storage/local.storage.ts`) back
on object storage; it is one class with four methods.

## Build

```bash
cd backend  && npm ci && npm run build     # -> backend/dist
cd frontend && npm ci && npm run build     # -> frontend/dist
```

Ship `backend/node_modules` from an `npm ci` on the same platform — `argon2` is
a native module. The frontend's `dist/` is plain static files with no runtime
dependency at all.

The frontend inlines its `VITE_*` variables at build time, so `VITE_API_BASE_URL`
must point at the production API **when you build**, not when you deploy.

## Environment

Everything from `.env.example`, with these production requirements. Set them in
your platform's secret store; **never** in the repository or an image layer.

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | must resolve to a replica set — the API's readiness probe reports `transactions: false` otherwise |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥32 chars, different from each other, `openssl rand -base64 48` |
| `TOTP_ENCRYPTION_KEY` | ≥32 chars. **Rotating it invalidates every enrolled admin TOTP.** |
| `COOKIE_SECURE` | `true` |
| `COOKIE_DOMAIN` | the API's domain. If the app and API are on different hosts, the refresh cookie is cross-site — set `SameSite=None; Secure`, or put both behind one domain |
| `CORS_ORIGINS` | exactly the frontend's origin, no wildcard |
| `AI_PROVIDER` | must be `gemini`. **The process refuses to boot in production with `stub`.** |
| `RAZORPAY_*` | live keys, or payments return `503` — which is honest, but not a shop |
| `EMAIL_PROVIDER` | `resend` + `RESEND_API_KEY` (never `console` in production) |
| `UPLOAD_DIR` | an absolute path on a persistent volume |
| `LOG_LEVEL` | `info` |

`backend/src/lib/config` validates the whole environment at boot and refuses to start
on anything missing or malformed, which is the behaviour you want: fail at
deploy time, not on the first request.

## Database migrations

Migrations are the **only** thing that creates indexes — `autoIndex` is off in
every model. Run them as a separate step before the new API version takes
traffic:

```bash
cd backend
NODE_ENV=production npm run db:migrate
npm run db:status        # confirm
```

Do **not** run `npm run db:seed` in production. It refuses anyway.

Index builds on a large collection can be slow. For a live cluster prefer a
rolling build; the migrations are ordinary `createIndex` calls and can be given
`{ background: true }` semantics by your platform's maintenance window.

## Rollout

1. Build both halves and publish the artifacts.
2. Run migrations. They are additive — an old API instance keeps working
   against the new indexes.
3. Deploy the API, with `/api/v1/health/ready` as the readiness probe and
   `/api/v1/health/live` as liveness. In-flight background jobs are lost on
   restart; the sweeps repair what they can.
4. Deploy the frontend's static build.
5. Point Razorpay's webhook at `https://api.anvesh.travel/api/v1/payments/webhook`
   and confirm `RAZORPAY_WEBHOOK_SECRET` matches the dashboard.

Rolling back the code is safe. Rolling back a migration is not automatic —
`npm run db:migrate:down` exists but reverses only the last migration, so treat
destructive changes as forward-only.

## Operations

**Request tracing.** Every request has an `X-Request-Id` that appears on the
response, in `meta.requestId`, and on every log line for that request. Ingest
logs as JSON (they are pino) and index on `requestId`.

**No PII in logs.** Emails, names and tokens are never logged. If you add
logging, keep it that way — it is a property the codebase currently has, and it
is easy to lose.

**What to alert on:**

- `/api/v1/health/ready` reporting `transactions: false` — you are not on a
  replica set and booking is at risk
- `job failed, giving up` in the logs — a background job exhausted its retries
- `PAYMENT_SIGNATURE_INVALID` or `WEBHOOK_SIGNATURE_INVALID` appearing at all
- `AI_HALLUCINATED_REFERENCE` rate climbing — the model is drifting; the
  guardrail is catching it, but the prompt needs attention
- `429` rate on `login` — credential stuffing

**Backups.** MongoDB point-in-time recovery, and treat `recommendationconfigs`
as configuration worth versioning: it holds the ranking weights, so a bad edit
changes what the whole product recommends. The admin ranking editor writes a new
version rather than mutating the active one.

## Security posture at deploy time

- TLS everywhere; HSTS on both hosts.
- The `/admin` routes are only a client-side path — the real boundary is the
  API's portal and role guards plus mandatory TOTP. If you want network-level
  protection for staff too, serve the admin build separately behind an IP
  allowlist or a VPN.
- Rate limits are per API process. With more than one instance they no longer
  hold globally — see the scaling note above.
- Rotate `JWT_*` secrets by deploying the new value; existing access tokens fail
  closed within 15 minutes and refresh tokens are rejected, forcing a re-login.
- `node scripts/check-secrets.mjs` in CI, before anything is built.

Full detail: [`security.md`](./security.md).

# Architecture

## 1. Topology

```
                    ┌───────────────────────────────────────────┐
                    │             frontend/                     │
                    │        React 19 + Vite + React Router     │
                    │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │
                    │  │  src/    │ │  src/    │ │  src/     │  │
                    │  │  user    │ │  guide   │ │  admin    │  │
                    │  │  /       │ │  /guide  │ │  /admin   │  │
                    │  └──────────┘ └──────────┘ └───────────┘  │
                    └────────────────────┬──────────────────────┘
                            HTTP + X-Portal + Bearer JWT
                                         ▼
                                ┌──────────────────┐
                                │     backend/     │  Express 5, /api/v1
                                │  Router          │
                                │   → Guards       │  jwt -> portal -> roles
                                │   → Zod validate │
                                │   → Service      │  business logic
                                │   → Repository   │  scoped Mongo filters
                                │   → Jobs         │  in-process, no queue
                                └────┬────────┬────┘
                                     │        │
                       ┌─────────────▼─┐   ┌──▼──────────────┐
                       │   MongoDB     │   │  backend/uploads│
                       │   (Mongoose)  │   │  served /uploads│
                       └───────────────┘   └─────────────────┘
                        ┌──────────────┬──────────┬───────────────┐
                        ▼              ▼          ▼               ▼
                    Resend / SMTP   Gemini     Ola Maps        Razorpay
                    (email)         (AI)       (tiles)         (payments)
```

The browser never talks to MongoDB. Only the backend opens a Mongo connection.

Three portals, one React app. They are route prefixes rather than three
deployments, but they are not one session: each portal keeps its own token, its
own React Query cache and its own sign-in page, and the API still checks the
`X-Portal` header against what the token was issued for.

## 2. Request lifecycle (backend — Express 5)

The API is a plain Node.js + Express 5 service written in TypeScript. Express 5
forwards rejected promises to the error middleware natively, so every handler is a
normal `async` function and there is no wrapper needed.

Middleware order, exactly as mounted in `src/app.ts`:

1. `requestId` — read or mint `X-Request-Id`, store it in an `AsyncLocalStorage`
   context so every log line and error envelope can reach it, and echo it back.
2. `helmet()`, CORS allowlist, `compression()`, `cookieParser()`, JSON body limit.
3. `mongoSanitize` — recursively reject any key starting with `$` or containing `.`
   (`400 INVALID_INPUT`). Rejecting beats stripping: a crafted payload fails loudly.
4. `rateLimit(<named policy>)` — in-process sliding window per route group.
5. `requireAuth` — verify the access token, load `AuthUser`
   (`{ userId, role, portal, tokenVersion }`) onto `req.auth`. Public routes simply
   do not mount it; there is no opt-out flag that can be forgotten.
6. `requirePortal(Portal.TOURIST_GUIDE)` — compares `req.auth.portal` with the portal
   the router declares. Mismatch is `403 PORTAL_MISMATCH`.
7. `requireRoles(...)` — role check, separate from the portal check by design.
8. `validate({ body, query, params })` — Zod schemas from `src/lib/validation`
   parse and REPLACE the request values, so a handler can never see an unvalidated
   field. Parse failure is `422 VALIDATION_ERROR` with per-field details.
9. Controller — orchestration only: pull the principal off `req.auth`, call one
   service method, send the envelope. No business rules, no database access.
10. Service — business logic, transactions, event emission.
11. Repository — the only layer that touches Mongoose. Every method that reads an
    owned resource takes the owner id and puts it **in the filter**, never in a
    post-fetch `if`.
12. `notFoundHandler` then `errorHandler` (the terminal 4-arg middleware) — maps
    every throwable to the error envelope. Unknown errors become
    `500 INTERNAL_ERROR` with a generic message; the stack and any Mongo error text
    go to the structured log only.
13. `httpLogger` (pino-http) — one structured line per request:
    `{ requestId, method, path, status, ms, userId?, portal? }`. No PII, no bodies.

Routers are assembled in `src/routes/index.ts` and mounted under `/api/v1`. Each
feature owns a folder with `*.routes.ts`, `*.controller.ts`, `*.service.ts` and
`*.repository.ts`, which keeps every file well under the 400-line limit.

Dependency wiring is explicit and constructor-based (a small `container.ts` builds
each service once at boot) rather than decorator-driven, so the whole graph is
readable and every service is trivially unit-testable with fakes.

## 3. Module map (backend/src/modules)

```
common/        request-id, logging, filters, pipes, guards, decorators, interceptors
health/        liveness + readiness (mongo, replica set)
auth/          register, login, refresh, logout, verify-email, password reset, TOTP
users/         profile, preferences, saved places, collections
admin-auth/    invite acceptance, admin login + TOTP challenge
places/        public read + discovery; guide-scoped write
destinations/  curated destination documents
categories/    taxonomy
discovery/     search, nearby, map bounds, hidden gems, personalised feed
experiences/   guide-owned bookable experiences
availability/  slots, calendar, blackout dates
bookings/      create (atomic), list, detail, cancel
payments/      Razorpay order, verify, webhook, refund
reviews/       CRUD + reporting
trips/         trip planner CRUD + day/activity ops
ai/            provider abstraction, discovery, itinerary, explanation, guardrails
recommendations/ ranking engine + config
media/         presigned upload, finalise, delete
notifications/ in-app feed + email dispatch enqueue
guides/        public guide profile + guide-scoped dashboard/analytics/earnings
admin/         users, guides, moderation, bookings, payments, reports, config,
               audit, analytics, system health
```

## 4. Ranking engine

`backend/src/lib/shared/ranking` holds pure, dependency-free scoring functions.
`backend/src/modules/recommendations` loads the active `RecommendationConfig`
(cached in the process for five minutes, invalidated on admin write) and applies
it. Because the scorer is pure, its
invariants are unit-testable without a database:

* raising `popularityScore` lowers the final score,
* raising `crowdLevel` lowers the final score,
* raising `localOwnership` / `authenticity` raises it,
* weights come from config, never from constants.

Ranking is applied in two places: at query time (a bounded candidate set from a
`$geoNear`/`$text` stage is re-scored in the service) and offline (a nightly job
recomputes `discoveryScore` on places so cold-start feeds are cheap).

## 5. Denormalisation strategy

Hot read paths must not `$lookup`. Places and experiences embed:

```ts
guideSummary: { guideId, displayName, slug, avatarUrl, verified, ratingAvg, ratingCount }
placeSummary: { placeId, title, slug, coverImageUrl, city, state, categorySlugs }
```

These are written inside the same transaction as the source change where possible, and
otherwise repaired by the `summary` job, which is also run nightly as a
consistency sweep.

## 6. Frontend architecture

* A Next.js 15 (App Router) app in TypeScript. Routing is filesystem-based —
  `app/(traveller)/**`, `app/guide/**`, `app/admin/**` — with one thin
  `page.tsx` per screen that renders the matching component under
  `src/*/pages`. The real screens still live under `src/`; `app/` only
  supplies Next's routing conventions (`layout.tsx`, `error.tsx`,
  `not-found.tsx`) plus the generated `page.tsx` wrappers.
* Each portal keeps its `router.tsx` shim — same exported API as before
  (`Link`, `useRouter`, `usePathname`, `useSearchParams`, `useParams`,
  `BASE`/`withBase`/`stripBase`), now backed by `next/link` and
  `next/navigation` instead of react-router-dom. Pages still write paths as if
  their portal owned the site — `/bookings`, `/places/new` — the shim maps
  them onto the real URL, and it remains the only file that knows about the
  `/guide` and `/admin` prefixes.
* `src/ui` is the design system (`Button`, `Card`, `Dialog`, `Skeleton`,
  `EmptyState`, `ErrorState`, …) plus the Anvesh Tailwind 4 theme.
* The traveller portal also ships a floating AI chat widget
  (`src/user/components/ai-chat-widget.tsx`), rendered from
  `src/user/layout.tsx` on every traveller page. It drives the same
  `POST /ai/discover` endpoint as the `/ai` page — no separate integration —
  so it inherits the real degraded-provider notice when `GEMINI_API_KEY` is
  unset.
* TanStack Query owns all server state. Query keys are centralised per portal in
  `lib/query-keys.ts`. Every list screen ships loading / error / empty states —
  these are components, not ad-hoc JSX.
* Zustand is used only for genuinely client-only state: the traveller portal has
  `useSessionStore` and `useMapStore`; guide and admin have one store each.
* `src/lib/types`, `src/lib/shared` and `src/lib/validation` are the same
  contract files the backend uses, so the client cannot drift from the server.
* Auth: access token in memory + refresh token in an `httpOnly`, `SameSite=Lax`
  cookie. A silent-refresh interceptor retries a single 401 once, and concurrent
  401s share one refresh call.

## 7. Background jobs

`backend/src/jobs` runs inside the API process. `JobRunner` dispatches work
fire-and-forget with bounded retries, and two timers replace what were
repeatable queue jobs: seat release every five minutes, and a nightly sweep
(ranking refresh, guide summary sync, stale upload purge). Job names are kept —
`email`, `notification`, `recommendation`, `analytics`, `media`, `summary`,
`ai`, `cleanup` — and every payload is still Zod-validated by the processor.

This replaced a Redis-backed BullMQ queue and a separate worker process. The
trade-off is explicit: work in flight is lost if the process dies, and this does
not scale past one API instance. `EXPIRE_BOOKINGS` — the job that actually
matters, because it returns held seats — is a sweep, so a missed run is repaired
by the next one rather than lost. Reintroducing a queue means putting
`QueuePublisher` back on a real broker; nothing else calls the jobs directly.

## 8. Environments

`backend/src/lib/config` parses `process.env` through a Zod schema once at boot
and throws a readable aggregated error if anything required is missing. Nothing
in the backend reads `process.env` directly outside that module.

On the frontend the equivalent is each portal's `lib/env.ts`, reading the
`VITE_*` variables Vite inlines at build time. Nothing secret goes there —
those values ship inside the JavaScript bundle.

# Spec Conflicts & Environment Constraints

Per Phase 0 rules: `docs/spec.md` did **not** exist before this build, so there was no
pre-existing spec to conflict with. `docs/spec.md` has been generated *from* the build
prompt and the build prompt remains the higher-priority source of truth.

The items below are (a) internal ambiguities inside the build prompt and (b) hard
constraints of the environment this repository was authored in. Nothing here was
silently ignored.

---

## 1. Internal ambiguities in the build prompt

| # | Conflict | Resolution |
|---|----------|------------|
| C1 | §15/§16/§17 list ~82 pages across three portals, but §15 also says "Do not create all pages blindly. Only implement pages that have real functionality and real APIs." | Every listed page is implemented **only** where a real API backs it. Pages with no backing API are not shipped as dead links; the sidebar/nav does not link to them. `docs/pages.md` records the final page inventory per portal and the API each page consumes. |
| C2 | §39 forbids fake functionality; §19 requires AI features; no AI key is available at build time. | The Gemini provider is a real implementation against the Gemini REST API. A second provider (`stub`) is selected **only** when `AI_PROVIDER=stub`. The stub is deterministic, database-backed (it ranks and selects **real** seeded documents, never invented ones) and every response is clearly marked `provider: "stub"` in the API payload and in the UI. Documented in README §"Providers that need your keys". |
| C3 | Section numbering in the prompt repeats (`43` appears twice, `44` appears twice). | Ignored — numbering only, no semantic impact. |
| C4 | §5 says Trip embeds "days / bounded activities"; §22 requires activity reordering and unbounded editing. | Trips embed days and activities with a hard server-side cap (`MAX_DAYS=30`, `MAX_ACTIVITIES_PER_DAY=20`) enforced in Zod + `$jsonSchema`. This keeps the document bounded while satisfying reorder/edit. |
| C5 | §29 caps Zustand at 3 stores, but there are 3 frontend apps. | The cap is read per-app: each app may hold at most 3 stores. In practice `web` uses 2 (auth-session, map-ui), `guide` 1, `admin` 1. |
| C6 | §8 forbids `$lookup` on hot read paths; admin/analytics screens legitimately need joins. | `$lookup` is permitted **only** on admin/report/analytics endpoints, which are explicitly cold paths, and each such usage carries a `// COLD PATH:` comment. Hot traveller paths use denormalized `guideSummary` / `placeSummary` sub-documents. |
| C7 | §25 requires Razorpay; §39 forbids fake booking success. | Payments are real Razorpay Orders API + real HMAC-SHA256 signature verification (works offline, no key needed to verify the algorithm). Without `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` the client reports `configured: false` and every payment endpoint returns `503 PAYMENT_PROVIDER_NOT_CONFIGURED` rather than a fake success. There is no code path that confirms a booking without a verified signature. |
| C8 | The build prompt fixes the API framework as NestJS 11 and says "do not substitute technologies". Mid-build the user explicitly instructed: *"make a backend using node js express not nestjs"*. | A direct instruction from the user outranks the written prompt. `backend/` is a Node.js + Express 5 TypeScript service. The layering the prompt asked for is preserved exactly — router (orchestration only) -> validation -> guards -> service -> repository -> MongoDB — using explicit middleware and constructor injection instead of Nest decorators. Every other technology choice is unchanged. |
| C9 | §33 pins the type stack and §37 expects a polished UI; the build sandbox cannot reach `fonts.googleapis.com`, so web fonts fail at build time. | Web fonts were removed. `--font-anvesh-sans` and `--font-anvesh-display` are assigned system font stacks in `frontend/src/styles/index.css`. Swapping in a hosted or self-hosted face is a one-line change there, and nothing else in the design system depends on the specific family. |
| C10 | The original build used a pnpm + Turborepo monorepo with three Next.js apps, a Redis-backed BullMQ worker and S3-compatible object storage. The project owner asked for a plain **MERN** project with separate `frontend/` and `backend/` folders, and explicitly does not use pnpm or Docker. | The stack was converted, not re-implemented. `pnpm`/Turborepo → two `npm` projects; the six workspace packages were folded into `backend/src/lib` and `frontend/src/lib` with relative imports. Next.js → React 19 + Vite + React Router 7; the three apps became three route prefixes (`/`, `/guide`, `/admin`) in one SPA, each keeping its own login page, session and query cache. Redis + BullMQ + the worker process → `backend/src/jobs/runner.ts`, running the same processors in-process with bounded retries and two timers. MinIO/R2 → `FileStorage`, writing to `UPLOAD_DIR` and serving `/uploads`, keeping the approve-then-upload flow with an HMAC-signed token in place of a presigned S3 URL. Mailpit → `EMAIL_PROVIDER=console` by default. Business logic, the data model, the API surface and all 148 unit tests are unchanged. The costs are written down in `deployment.md`: rate limits and job schedulers now assume a single API instance, and uploads need a persistent disk. |
| C11 | The project owner asked for the UI and UX of a separate prototype (Raahi, built in Lovable) with Anvesh's backend, data model and features kept, plus Raahi's own features added. | The design system was re-skinned rather than replaced: token values in `frontend/src/ui/styles/theme.css` changed (near-white surfaces, charcoal type, sans headings, shadow-defined cards, larger radii, terracotta accent) while every token NAME stayed, so all 71 screens moved together. Raahi's structure was adopted where it exists in Anvesh: its navigation (Explore · AI Planner · Map · Stories · For Locals), its discovery-card anatomy (match %, category, distance, price, crowd, authenticity, "why this is here"), its chip-row filters, a traveller dashboard at `/dashboard`, an `/partner` page, and a partner-shaped guide dashboard. Raahi's Local Stories had no equivalent, so it was built end to end — model, migration, validation, service, guide authoring, admin moderation, public pages and seed data. The exact palette could not be measured: the prototype's stylesheet was not reachable through the tooling available here, so colours were matched from a description of the rendered page rather than sampled. Everything Anvesh had that Raahi did not — bookings, payments, refunds, availability, reviews, notifications, the audit log, ranking configuration, AI monitoring — is untouched. |
| C12 | Raahi's dashboards show figures Anvesh does not compute: an "AI insight" paragraph, "appears in food queries 92%", a "Travel DNA" string, week-on-week percentage changes. | Those were not reproduced as decoration. Where Anvesh has the data the widget was built on it (views this week from real interaction events, bookings, seats, net earnings, saved places, upcoming bookings, stored preferences). Where it does not, the widget is absent — with one substitution: the guide dashboard's insight box is a sentence chosen from facts already on the page ("3 places waiting on moderation", "no open slots in the next 30 days"), and it is labelled "What to look at next" rather than an AI insight, because nothing generates it. |
| C11 | §44 requires Conventional Commits and a commit after every phase; the sandbox had no git repository initialised until the end of the build. | History was created at the end rather than incrementally. Commits follow Conventional Commits and are grouped by area (`feat(database)`, `feat(api)`, `feat(web)`, `test(api)`, `docs`), so the diff is reviewable, but the timeline does not reflect the phase-by-phase order in which the code was actually written. |

## 2. Environment constraints of this build sandbox

This repository was authored inside an isolated cloud container with a restricted
network allowlist. The following were verified, not assumed:

| Resource | Status in build sandbox | Consequence |
|----------|------------------------|-------------|
| `registry.npmjs.org` | reachable | dependencies install normally |
| `archive.ubuntu.com` | reachable | system packages installable |
| Docker Hub / ghcr.io / quay.io / gcr.io | **403 / blocked** | container images could not be pulled |
| `fastdl.mongodb.org`, `repo.mongodb.org`, `downloads.mongodb.com` | **blocked** | the `mongod` binary could not be downloaded, so **no MongoDB server could be started in the build sandbox** |
| MongoDB in Ubuntu apt | not packaged on Noble | same |
| Chromium (Playwright) | available locally | the frontend smoke run below was really executed |

### What this means, precisely

* Everything that does not need a live `mongod` is **really executed and really verified**:
  `npm run typecheck` and `npm test` in `backend/` (148 passing), `npm run build` in
  `frontend/`, and a Playwright run that loaded all 62 routes and checked that
  in-app navigation, the active-nav state and the sign-in return path work across
  all three portals.
* The replacement infrastructure was exercised directly against the real Express
  app: container wiring, 104 documented routes, the approve → upload → serve
  media flow including a tampered-token rejection, and job dispatch without a
  queue server.
* Everything that needs a live `mongod` — `npm run db:migrate`, `npm run db:seed`,
  `npm run test:integration`, `npm run test:e2e` — is **fully implemented**, but
  **was not executed** in the build sandbox. These suites are written against
  `mongodb-memory-server` (replica-set mode), which works on a normal developer
  machine.
* No test output in this repository or in the delivery report is fabricated. Any command
  that was not run is reported as *not run*, with this file as the reason.
* `TODO.md` at the project root lists exactly what remains to be verified on a machine
  that can reach mongodb.org.

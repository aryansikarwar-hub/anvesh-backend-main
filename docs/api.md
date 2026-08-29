# API

Base URL: `/api/v1`. The machine-readable contract is
[`openapi.json`](./openapi.json) — 103 paths, 124 operations, generated from the
live Express router — and Swagger UI is served at `/api/v1/docs`.

## Envelope

Every response, success or failure, has the same shape.

```jsonc
// 200
{
  "success": true,
  "data": { "place": { "id": "…", "title": "…" } },
  "meta": { "requestId": "8f2c…", "timestamp": "2026-08-26T09:12:44.913Z" }
}
```

```jsonc
// 409
{
  "success": false,
  "error": {
    "code": "SLOT_SOLD_OUT",
    "message": "Those seats were taken while you were deciding.",
    "details": { "requested": 2 }
  },
  "meta": { "requestId": "8f2c…", "timestamp": "2026-08-26T09:12:44.913Z" }
}
```

`meta.requestId` matches the `X-Request-Id` response header and every log line
for that request. Quote it in a bug report and the whole request can be traced.

Stack traces, database errors and internal messages never reach a client. An
unexpected error becomes `500 INTERNAL_ERROR` with a generic message; the detail
goes to the log, keyed by the same request id.

## Errors

Every code is defined in `backend/src/lib/types/error-codes.ts` — 100 of them, the
single source of truth, shared by the API and all three frontends. Each maps to
exactly one HTTP status, and a test fails if a code has no status.

| Status | Used for | Examples |
| --- | --- | --- |
| 400 | Malformed request | `INVALID_INPUT`, `BAD_REQUEST` |
| 401 | Not authenticated | `UNAUTHORIZED`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED` |
| 403 | Authenticated, not allowed | `PORTAL_MISMATCH`, `ROLE_NOT_ALLOWED`, `AUTH_ACCOUNT_SUSPENDED` |
| 404 | Absent, or not yours | `PLACE_NOT_FOUND`, `BOOKING_NOT_FOUND` |
| 409 | State conflict | `SLOT_SOLD_OUT`, `AUTH_EMAIL_ALREADY_REGISTERED`, `IDEMPOTENCY_KEY_REUSED` |
| 422 | Failed schema validation | `VALIDATION_ERROR` (with a per-field `details`) |
| 429 | Rate limited | `RATE_LIMITED` (with `Retry-After`) |
| 503 | Provider not available | `PAYMENT_PROVIDER_NOT_CONFIGURED`, `AI_PROVIDER_NOT_CONFIGURED` |

Two deliberate choices worth calling out:

- **Cross-tenant access is `404`, not `403`.** Guide A asking for Guide B's
  place must not learn that it exists. Ownership is part of the Mongo query
  filter, so the answer is genuinely "no such document for you".
- **Auth failures are generic.** A wrong password and an unknown email give the
  same `AUTH_INVALID_CREDENTIALS`, so the endpoint is not an account oracle.

## Authentication

```http
Authorization: Bearer <access token>
```

Access tokens are JWTs, 15 minutes, carrying `sub`, `role`, `portal` and `tv`
(token version). Refresh tokens are opaque, 30 days, stored only as SHA-256
hashes, and rotate on every use.

**Reuse detection:** presenting a refresh token that has already been rotated
revokes the entire token family, on the assumption it was stolen.

`POST /auth/refresh` returns a new pair. `POST /auth/logout` revokes the current
family. Changing a password bumps the user's token version, which revokes every
outstanding session at once.

Admins do not use `/auth/login` at all — `/admin-auth/login` returns a
**challenge**, and a session only exists after `/admin-auth/totp` verifies a
real code or a recovery code.

### The three checks

Authentication, portal and role are separate, and ownership is a fourth layer
inside the query itself:

```ts
router.use(requireAuth(tokens), requirePortal('TOURIST_GUIDE'), requireRoles('TOURIST_GUIDE'));
// …and then, in the repository:
PlaceModel.findOne({ _id: placeId, guideId, deletedAt: null })
```

`userId`, `role`, `portal` and `guideId` are **never** read from a request body.
They come from the verified token, and the request schemas are `z.strictObject`,
so sending them is a `422` rather than a silent no-op.

## Pagination

```http
GET /api/v1/discovery/search?q=waterfall&page=2&limit=24
```

`page` starts at 1, `limit` is capped per endpoint (24 default, 100 maximum).

```jsonc
{
  "success": true,
  "data": {
    "items": [ … ],
    "pageInfo": { "page": 2, "limit": 24, "total": 137, "totalPages": 6, "hasNext": true, "hasPrevious": true }
  }
}
```

## Idempotency

`POST /bookings` accepts an `Idempotency-Key` header. Replaying the same key
returns the original booking instead of holding seats twice; presenting another
user's key is `409 IDEMPOTENCY_KEY_REUSED`. If the header is absent the server
generates one, so a booking can never be created twice by a double-click within
one request.

## Money

Every monetary field is an **integer in minor units** (paise) and named to say
so: `priceMinor`, `subtotalMinor`, `commissionMinor`, `totalMinor`,
`amountMinor`, `capturedMinor`, `refundedMinor`. Floats are never used for
money, in transit or at rest — the Mongoose schema rejects a non-integer and
`assertMinor()` throws.

`₹2,500.00` is `250000`. Formatting happens once, in
`@anvesh/shared/util/money.ts`, and shows paise only when they are non-zero so
`999.50` never displays as `1,000`.

## Rate limits

Counted in the API process's memory, keyed by user id when authenticated and by IP otherwise.
`429` responses carry `Retry-After`.

| Bucket | Applies to |
| --- | --- |
| `login` | 5 per 15 min, keyed by email, then blocked for 15 min — the tightest |
| `register`, `passwordReset`, `totp` | 5 per window |
| `refresh` | 30 per hour |
| `write` | 60 per minute — content mutations |
| `booking`, `payment` | 10 per minute each |
| `discovery` | 120 per minute |
| `ai` | 20 per hour, plus a monthly per-user quota |
| `review`, `media` | 5 and 30 per hour |

## Webhooks

`POST /api/v1/payments/webhook` is unauthenticated but **signature-verified**:
HMAC-SHA256 over the exact raw bytes, compared in constant time. The raw body is
captured by the JSON body parser specifically so the signature can be checked
before parsing.

The handler is idempotent — `x-razorpay-event-id` is recorded once, so a
redelivery is a no-op — and it re-checks the amount against the booking total
before confirming anything. A mismatch is logged and refused rather than
confirmed.

There is no endpoint anywhere that marks a booking paid on a client's word.

## AI endpoints

Responses from `/ai/*` always include the provider:

```jsonc
{
  "success": true,
  "data": {
    "plan": { … },
    "provider": "stub",        // or "gemini"
    "degraded": true            // true whenever the stub is answering
  }
}
```

Before any AI response is returned, the model output is JSON-parsed,
Zod-validated, and then **every** referenced `placeId` and `experienceId` is
looked up in MongoDB and confirmed `PUBLISHED`. Anything that does not resolve
means the whole response is rejected with `AI_HALLUCINATED_REFERENCE` and
recorded for admin review at `admin.anvesh.travel/ai`. The model cannot put a
place in front of a user that does not exist.

## Health

`GET /api/v1/health/live` — liveness plus version and uptime.
`GET /api/v1/health/ready` — readiness, including MongoDB (and whether it really
is a replica set).
Neither leaks connection strings or internal hostnames.

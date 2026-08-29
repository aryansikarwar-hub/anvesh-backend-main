# Security Design

## 1. Threat model summary

| Asset | Threat | Control |
|---|---|---|
| User credentials | credential stuffing, offline cracking | argon2id (m=19456, t=2, p=1), per-route login throttle, generic auth errors |
| Sessions | token theft, replay | short-lived access JWT (15m), rotating refresh token (30d) stored hashed with reuse detection, `tokenVersion` bump on logout-all/password change |
| Cross-portal escalation | traveller token used on guide/admin API | `PortalGuard` compares `token.portal` against route metadata → `403 PORTAL_MISMATCH` |
| Cross-tenant data | guide A reads/edits guide B | owner id is part of every Mongo filter; guards are necessary but never sufficient |
| NoSQL injection | operator injection via JSON body/query | global sanitiser rejects `$`-prefixed and dotted keys; Zod strict objects strip unknowns |
| Payment fraud | client claims success | server-side Razorpay signature verification (HMAC-SHA256) + webhook verification + idempotency keys; no client-trusted state transition |
| Media abuse | oversized / disguised uploads | presigned PUT with content-length range + content-type pin, magic-byte re-check on finalise, per-user quota |
| Admin takeover | stolen admin password | invite-only accounts, mandatory TOTP, IP + UA recorded, full audit trail |
| Info leak | stack traces, Mongo errors | `AllExceptionsFilter` returns opaque `INTERNAL_ERROR`; diagnostics only in server logs |

## 2. Token design

```jsonc
// access token (15 min)
{ "sub": "<userId>", "role": "TOURIST_GUIDE", "portal": "TOURIST_GUIDE",
  "tv": 3, "typ": "access", "jti": "...", "iss": "anvesh", "aud": "anvesh:api" }
```

Refresh tokens are opaque 256-bit random values; only a SHA-256 hash is stored in
`refreshtokens` with `{ userId, portal, familyId, expiresAt, revokedAt, replacedBy }`.
Presenting an already-rotated token revokes the whole family (`AUTH_TOKEN_REUSED`).

## 3. Authorisation layers

1. **Authentication** — is the token valid and not revoked?
2. **Portal** — was this token minted for the portal this route belongs to?
3. **Role** — does the role satisfy the route's `@Roles(...)`?
4. **Ownership** — is the requesting principal the owner of the specific document?
   Implemented in the repository filter, e.g.
   `places.findOne({ _id, 'guideSummary.guideId': actorId, deletedAt: null })`.
5. **Field-level** — request DTOs never accept `userId`, `role`, `portal`, `guideId`,
   `status`, `commissionMinor`. These are stripped by strict Zod schemas and set
   server-side from the verified principal.

Negative-path tests exist for every one of layers 2–5.

## 4. Rate limits (per identity, sliding window, in-process)

| Route group | Limit |
|---|---|
| `POST /auth/login`, `/auth/register` | 5 / 15 min / IP+email |
| `POST /auth/forgot-password`, `/auth/resend-verification` | 3 / hour / email |
| `POST /auth/refresh` | 30 / hour / user |
| `POST /admin-auth/totp` | 5 / 10 min / user then lockout |
| `GET /discovery/*` | 120 / min / identity |
| `POST /ai/*` | 20 / hour / user, plus a monthly token budget per user |
| `POST /bookings`, `/payments/*` | 10 / min / user, idempotency key required |
| `POST /reviews` | 5 / hour / user |
| `POST /media/presign` | 30 / hour / user |

## 5. Secrets

Every secret is read through `backend/src/lib/config`. `.env.example` documents each variable
with type and whether it is required. `.gitignore` excludes `.env*` except
`.env.example`. A `npm run check:secrets` script greps the tree for high-entropy strings and
known key prefixes (`rzp_`, `re_`, `AIza`, …) and fails CI on a hit.

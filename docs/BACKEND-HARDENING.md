# Backend hardening (production readiness)

Production hardening for `/api/saas/*` before frontend development: rate limiting, caching, validation, error handling, indexes, and observability.

---

## 1. Rate limiting

**Location:** `apps/web/src/lib/rate-limit.ts`

- **Scope:** All routes under `/api/saas/*` when using `withSaaSHandler`.
- **Tiers (per minute):**
  - **analytics** (60 req/min): `/api/saas/analytics/*`, `/api/saas/dashboard/*`
  - **create_update** (20 req/min): POST/PATCH/PUT/DELETE on projects, quotes, engineering, documents, partners, org-members, territories, training enrollments
  - **auth** (10 req/min): `/api/saas/auth/*`
  - **read** (60 req/min): other GET requests
- **Identifier:** Client IP from `x-forwarded-for` or `x-real-ip` (Vercel/Node compatible).
- **Store:** In-memory by default (`memoryRateLimitStore`). For production with multiple instances or serverless, plug in a shared store (e.g. Redis, Vercel KV) via `setDefaultRateLimitStore(store)` and implement the `RateLimitStore` interface (`increment(key, windowMs)`).
- **Response:** `429` with body `{ error: { code: "RATE_LIMIT_EXCEEDED", message: "...", details: [] } }`.

---

## 2. Caching

**Location:** `apps/web/src/lib/cache.ts`, `withSaaSHandler` in `apps/web/src/lib/saas-handler.ts`

- **Scope:** GET only; no caching on create/update routes.
- **Endpoints and TTL:**
  - `/api/saas/analytics/*` → 60 seconds
  - `/api/saas/dashboard/*` → 30 seconds
  - `/api/saas/analytics/leaderboard` → 120 seconds
- **Cache key:** `pathname + searchParams + organizationId` (or `"platform"` for superadmin) so responses are tenant-scoped.
- **Store:** In-memory by default. For production, use `setDefaultCacheStore(store)` with a `CacheStore` implementation (e.g. Redis) providing `get(key)` and `set(key, value, ttlMs)`.

---

## 3. Validation layer

**Location:** `packages/core/src/validation/`

Centralized Zod schemas; import from `@vbt/core/validation`.

| Module | Schemas |
|--------|--------|
| **projects** | `createProjectSchema`, `updateProjectSchema`, `listProjectsQuerySchema` |
| **quotes** | `createQuoteSchema`, `updateQuoteSchema`, `quoteItemSchema`, `listQuotesQuerySchema` |
| **engineering** | `createEngineeringRequestSchema`, `updateEngineeringRequestSchema`, `engineeringFileSchema`, `engineeringDeliverableSchema` |
| **partners** | `createPartnerSchema`, `updatePartnerSchema`, `territorySchema`, `onboardingStateEnum` |
| **documents** | `createDocumentSchema`, `updateDocumentSchema`, `documentVisibilityEnum` |
| **training** | `createEnrollmentSchema`, `updateEnrollmentSchema`, `inviteOrgMemberSchema`, `updateOrgMemberSchema` |
| **analytics** | `analyticsPartnersQuerySchema`, `analyticsQuotesQuerySchema`, `analyticsLeaderboardQuerySchema`, `dashboardLimitQuerySchema`, `dateParamSchema` |

API routes use `schema.safeParse(...)` and throw the Zod error on failure; the unified error handler returns `400` with a structured body.

---

## 4. Error handling

**Location:** `apps/web/src/lib/api-error.ts`, used inside `withSaaSHandler`

- **Response shape:**
  ```json
  {
    "error": {
      "code": "...",
      "message": "...",
      "details": []
    }
  }
  ```
- **Mappings:**
  - `RateLimitExceededError` → 429, `RATE_LIMIT_EXCEEDED`
  - `TenantError` → 401/403 by code (`UNAUTHORIZED`, `NO_ACTIVE_ORG`, `FORBIDDEN`, `ORG_ACCESS_DENIED`)
  - `ZodError` → 400, `VALIDATION_ERROR`, `details` from `issues`
  - Prisma (e.g. P2002, P2025) → 409/404/400, `DB_ERROR`
  - Generic `Error` → 500, `INTERNAL_ERROR` (message hidden in production if desired)

---

## 5. Query performance and indexes

**Schema:** `packages/db/prisma/schema.prisma`

- **Added index:** `Quote` → `@@index([createdAt])` for analytics and dashboard queries by date.
- **Existing indexes** (unchanged): `Project` (`organizationId`, `status`, …), `Quote` (`organizationId`, `projectId`, `status`), `ActivityLog` (`createdAt`, `organizationId`, …).

Run a migration after adding the new index, e.g. `npx prisma migrate dev --name add_quote_created_at_index`.

---

## 6. Observability (structured logging)

**Location:** `apps/web/src/lib/api-logger.ts`, invoked from `withSaaSHandler`

Each request logs a JSON line with:

- `endpoint`, `method`
- `userId`, `organizationId` (when available)
- `durationMs`, `status`
- `level` (info / warn / error)
- `timestamp` (ISO)
- `error` (message when an error is caught)

Suitable for aggregation in external systems (e.g. Datadog, Logtail). No PII beyond IDs; adjust if needed for compliance.

---

## Usage summary

- **SaaS routes:** Use `withSaaSHandler(options, handler)` so that rate limiting, optional caching, error normalization, and logging apply.
- **Options:** `cacheTtl` (ms) for GET caching, `rateLimitTier`, `skipRateLimit`.
- **Validation:** Use schemas from `@vbt/core/validation`; on `safeParse` failure, throw the Zod error so the wrapper returns the unified error body.
- **Auth/tenant:** Keep using `getTenantContext()`, `requireActiveOrg()`, `requirePlatformSuperadmin()`; throw `TenantError` so the wrapper maps it to the correct status and body.

---

## Remaining gaps

- **Shared rate limit / cache store:** Replace in-memory store with Redis or Vercel KV for multi-instance or serverless production.
- **Auth rate limit:** If `/api/saas/auth/*` is implemented, ensure it uses the `auth` tier (10 req/min).
- **More routes:** Remaining SaaS routes (e.g. `quotes/[id]`, `projects/[id]`, `documents/[id]`, `partners/[id]`, org-members, territories, training) can be wrapped with `withSaaSHandler` and, where applicable, core validation schemas.

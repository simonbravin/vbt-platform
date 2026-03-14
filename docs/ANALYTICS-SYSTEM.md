# Analytics and Reporting System

Analytics and dashboard endpoints for pipeline, partner performance, quote analytics, and leaderboard. All results are scoped by **organizationId** (tenant) unless the caller is a **platform superadmin**.

---

## 1. Tenant rules

- **Non–superadmin:** All analytics and dashboard endpoints require an active organization. Results are filtered by `activeOrgId`. Without it, the API returns 403.
- **Platform superadmin:** May see platform-wide data when `activeOrgId` is null (e.g. pipeline across all orgs, all partners in leaderboard/partner performance). When `activeOrgId` is set, results are scoped to that org.

---

## 2. Pipeline analytics

**GET** `/api/saas/analytics/pipeline`

Returns pipeline metrics for the current tenant (or all orgs for superadmin).

### Response

| Field | Type | Description |
|-------|------|-------------|
| projects_total | number | Total project count |
| projects_by_status | Record<string, number> | Count per project status (lead, qualified, quoting, engineering, won, lost, on_hold) |
| quotes_total | number | Total quote count |
| quotes_by_status | Record<string, number> | Count per quote status (draft, sent, accepted, rejected, expired) |
| quotes_value_pipeline | number | Sum of quote totalPrice where status in (draft, sent) |
| quotes_value_won | number | Sum of quote totalPrice where status = accepted |
| quotes_value_lost | number | Sum of quote totalPrice where status in (rejected, expired) |

---

## 3. Partner performance

**GET** `/api/saas/analytics/partners`

Returns performance metrics per partner (organization). Supports optional filters.

### Query parameters

| Param | Type | Description |
|-------|------|-------------|
| dateFrom | ISO date string | Filter by createdAt >= dateFrom |
| dateTo | ISO date string | Filter by createdAt <= dateTo |
| partnerId | string | Single partner (organization) id |
| country | string | Filter partners by organization countryCode (superadmin only) |

### Response

Array of objects:

| Field | Type | Description |
|-------|------|-------------|
| projects_created | number | Projects created in range |
| quotes_created | number | Quotes created in range |
| quotes_sent | number | Quotes with status sent |
| quotes_accepted | number | Quotes with status accepted |
| conversion_rate | number | accepted / (sent + accepted), as percentage (e.g. 25.5) |
| revenue_total | number | Sum of totalPrice for accepted quotes |

- **Tenant:** With no `partnerId`, returns one element for the active org.
- **Superadmin:** With no `partnerId`, returns one element per partner org (optionally filtered by `country`).

---

## 4. Quote analytics

**GET** `/api/saas/analytics/quotes`

Returns quote funnel and value metrics for the current tenant.

### Query parameters

| Param | Type | Description |
|-------|------|-------------|
| dateFrom | ISO date string | Filter by quote createdAt >= dateFrom |
| dateTo | ISO date string | Filter by quote createdAt <= dateTo |

### Response

| Field | Type | Description |
|-------|------|-------------|
| quotes_created | number | Total quotes in range |
| quotes_sent | number | Quotes with status sent |
| quotes_accepted | number | Quotes with status accepted |
| quotes_rejected | number | Quotes with status rejected |
| average_quote_value | number | Average totalPrice (quotes with totalPrice > 0) |
| conversion_rate | number | accepted / (sent + accepted), as percentage |
| average_sales_cycle_days | number | Average (updatedAt − createdAt) in days for accepted quotes |

---

## 5. Dashboard endpoints

All require an active organization (or superadmin). Responses are kept small for dashboard UI.

### GET /api/saas/dashboard/overview

Lightweight summary:

| Field | Type |
|-------|------|
| projects_total | number |
| quotes_total | number |
| quotes_pipeline_value | number |
| quotes_won_value | number |

### GET /api/saas/dashboard/recent-projects

Recent projects (default 10, max 20).

**Query:** `limit` (optional, default 10)

Returns array of: id, projectName, status, countryCode, createdAt, client { id, name }.

### GET /api/saas/dashboard/recent-quotes

Recent quotes (default 10, max 20).

**Query:** `limit` (optional, default 10)

Returns array of: id, quoteNumber, version, status, totalPrice, createdAt, project { id, projectName }.

### GET /api/saas/dashboard/activity

Recent activity log entries (default 20, max 50).

**Query:** `limit` (optional, default 20)

Returns array of: id, action, entityType, entityId, createdAt, user { id, fullName }.

---

## 6. Partner leaderboard

**GET** `/api/saas/analytics/leaderboard`

Ranking of partners by revenue or quotes accepted.

### Query parameters

| Param | Type | Description |
|-------|------|-------------|
| sort | "revenue" \| "quotes_accepted" | Sort order (default revenue) |
| limit | number | Max entries (default 20, max 100) |
| dateFrom | ISO date string | Filter by quote/project createdAt |
| dateTo | ISO date string | Filter by quote/project createdAt |

### Response

Array of:

| Field | Type | Description |
|-------|------|-------------|
| partnerId | string | Organization id |
| partnerName | string | Organization name |
| projects | number | Project count in range |
| quotes | number | Quote count in range |
| quotes_accepted | number | Accepted quote count |
| revenue | number | Sum of totalPrice for accepted quotes |
| conversionRate | number | Percentage (accepted / (sent + accepted)) |

- **Tenant:** Only the active org appears (one row).
- **Superadmin:** All partner orgs (commercial_partner, master_partner), sorted by chosen metric.

---

## 7. Implementation notes

- **Core service:** `packages/core/src/services/analytics.ts` — all metrics use the same tenant helpers (`orgScopeWhere`) as the rest of the app.
- **Queries:** Use Prisma `count`, `groupBy`, `aggregate`, and targeted `findMany` with `select` to avoid heavy joins and keep responses small.
- **Revenue:** Defined as sum of `Quote.totalPrice` where `status = 'accepted'`. No separate revenue or payment model.
- **Sales cycle:** For quote analytics, sales cycle is `updatedAt - createdAt` for accepted quotes (no dedicated “accepted at” field).

---

## 8. Remaining gaps

- No date range defaults (e.g. “last 30 days”); callers send dateFrom/dateTo when needed.
- No caching; every request hits the database.
- Leaderboard and partner performance can be heavy with many partners; consider pagination or stricter limits later.

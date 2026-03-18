# Module migration status (Sprint 2)

Tracks incremental migration from legacy schema to Partner SaaS schema.  
**Target:** `organizationId`, tenant helpers, core services, `ActivityLog`, new model names.

**Frontend evolution:** For the dual-portal (Superadmin + Partner) product architecture, IA, permissions, configuration model, and implementation roadmap, see **`docs/FRONTEND-ARCHITECTURE-PLAN.md`**.

---

## 1. Compatibility audit summary

### Build blockers (resolved in Sprint 2)

| Location | Status |
|----------|--------|
| **Projects** | Fixed: organizationId, core listProjects/createProject/updateProject, activityLog, ProjectsClient/ProjectDetailClient/new page use new schema. |
| **Quotes** | Quote Creation V1: POST/PATCH/duplicate via /api/saas/quotes; createQuote with items in core; minimal /quotes/create UI; QuotesClient uses new schema (quoteNumber, totalPrice, project.projectName/client). |
| **Dashboard** | Fixed: organizationId, status not "lost", quote status draft/sent, project projectName/client; sales YTD removed (no Sale model). |
| **Reports** | Stubbed: api/reports/* return empty or 501. |
| **Clients** | Fixed: organizationId, countryCode, clientType; no country relation. |
| **Sales / Catalog / Import / Inventory / Freight / Tax** | Stubbed: all return 501 or empty so build passes. |
| **Admin** | Fixed: prisma.organization, orgMember.organization; User isActive/OrgMember role; warehouses stubbed. |
| **Audit** | Fixed: activityLog, metadataJson cast; projects/logs and quotes/audit use activityLog. |

### Runtime blockers (after build passes)

| Location | Issue |
|----------|--------|
| **Sales module** | `prisma.sale`, `prisma.saleInvoice`, `prisma.billingEntity` — **not in new schema**. Sales not migrated; routes will 500 at runtime if hit. |
| **Countries** | `prisma.countryProfile` — **not in new schema**. Use `countryCode` on Client/Project or static list. |
| **Admin settings** | `prisma.org` — use `prisma.organization`. |
| **Warehouses / Inventory** | Warehouses are in the new schema (`organizations`, `warehouses`, `inventory_levels`, `inventory_transactions`). Use `/api/saas/warehouses` and `/api/saas/inventory/*`. |
| **Freight / Tax rules** | `orgId`, `countryId` — new schema has no CountryProfile/FreightRateProfile/TaxRuleSet. |

### Non-blocking technical debt

- Session backward compat: `orgId` / `orgSlug` on session (deprecated; use `activeOrgId`). Convención única: DB = `organization_id`, Prisma = `organizationId`, sesión = `activeOrgId`; usar `getEffectiveOrganizationId(user)` para la org actual.
- `createAuditLog` → `createActivityLog` (already wrapped in audit.ts).
- Legacy enums: `DRAFT`, `SOLD`, etc. vs new `lead`, `won`, `draft`.

---

## 2. Legacy usages by category

### organization_id / organizationId / activeOrgId (convención única)

- **DB:** Todas las FKs a organizaciones usan la columna `organization_id` (snake_case). No usar `orgId` ni `organizationId` como nombre de columna en PostgreSQL.
- **App:** Usar `getEffectiveOrganizationId(session.user)` para obtener la org actual (devuelve `activeOrgId ?? orgId` legacy). Pages y API routes refactorizados para usar este helper.

### Org / prisma.org

- `api/quotes/route.ts` (findUnique org).
- `api/admin/settings/route.ts` (findFirst/update org).

### CountryProfile

- `api/countries/route.ts`, `api/countries/[id]/route.ts`.
- `reports/page.tsx` (findMany countryProfile).
- Legacy Project/Quote/Client included `country` relation.

### Sale / SaleInvoice / BillingEntity

- All of `api/sales/*`, `dashboard/page.tsx` (salesYtdRows), `reports/*`, sales UI components.  
- **Decision:** Leave Sales module as legacy; not in new schema. Document as “legacy; do not use until Sales is redesigned”.

### clientRecord, baselineQuote, isArchived, wallAreaM2*, country (relation)

- Projects and Quotes pages/API; reports; dashboard.  
- New schema: `client` (relation), no baselineQuote, no isArchived (use status), `estimatedTotalAreaM2` / `estimatedWallAreaM2`, no country relation (use `countryCode`).

### auditLog → activityLog

- `api/projects/[id]/audit/route.ts`, `api/projects/logs/route.ts`, `api/quotes/[id]/audit/route.ts`, `api/inventory/logs/route.ts`.  
- Use `prisma.activityLog` and string `action` + `metadataJson`.

---

## 3. Module status

### Projects — Target: Migrated (Sprint 2)

| Item | Status | Notes |
|------|--------|--------|
| `app/(dashboard)/projects/page.tsx` | Migrated | Uses tenant context + core listProjects or direct Prisma with organizationId, client, new fields. |
| `app/(dashboard)/projects/[id]/page.tsx` | Migrated | Uses getProjectById or Prisma with organizationId, client, quotes. |
| `app/api/projects/route.ts` | Migrated | GET uses core listProjects; POST uses core createProject; tenant helpers; createActivityLog. |
| `app/api/projects/[id]/route.ts` | Migrated | GET/PATCH/DELETE use core or Prisma with organizationId; new Project fields; activityLog. |
| `app/api/projects/[id]/audit/route.ts` | Migrated | activityLog, organizationId. |
| `app/api/projects/logs/route.ts` | Migrated | activityLog, organizationId. |
| `ProjectsClient.tsx` / `ProjectDetailClient.tsx` | Adapted | Use `client`, `projectName`, `estimatedTotalAreaM2` / `estimatedWallAreaM2`; no baselineQuote/country/clientRecord. |
| `projects/new/page.tsx` | Adapted | Form posts projectName, clientId, countryCode, estimatedTotalAreaM2; API uses new schema. |

### Quotes — Quote Creation V1 (Sprint 2)

| Item | Status | Notes |
|------|--------|--------|
| `app/(dashboard)/quotes/page.tsx` | Migrated | organizationId; list with project.projectName, client, countryCode; statuses draft/sent/accepted/rejected/expired. |
| `app/(dashboard)/quotes/create/page.tsx` | New | Minimal create: project select, POST /api/saas/quotes, redirect to /quotes/[id]. |
| `app/(dashboard)/quotes/QuotesClient.tsx` | Migrated | New schema type (quoteNumber, totalPrice, project.projectName, project.client); search uses /api/saas/quotes. |
| `app/api/saas/quotes/route.ts` | Migrated | GET listQuotes (search, status, projectId); POST createQuote with optional items, pricing; quoteNumber generated if omitted. |
| `app/api/saas/quotes/[id]/route.ts` | Migrated | GET getQuoteById; PATCH updateQuote (status, pricing, items replace). |
| `app/api/saas/quotes/[id]/duplicate/route.ts` | New | POST duplicateQuote (new version, draft). |
| Core `packages/core/src/services/quotes.ts` | Extended | createQuote with items in transaction; updateQuote with optional items replace; duplicateQuote; listQuotes search. |
| Legacy quote wizard `/quotes/new` | Deprecated | Redirects to `/quotes/create`. CSV/Revit flow not migrated; create draft then add items from quote detail. |
| Quote items `catalogPieceId` | Migrated | Validation, core create/update/duplicate, and saas/quotes accept and persist `catalogPieceId`. "Affect inventory by quote" and "simulate" require items with `catalogPieceId`; quote-by-m² only is estimation and does not feed inventory. |

### Clients — Migrated

- List/detail pages and ClientDetailActions use `organizationId` and new Client model.  
- `api/clients/route.ts`, `api/clients/[id]/route.ts`, `api/clients/stats/route.ts`: use organizationId, countryCode, clientType; no country relation.

### Dashboard

| Item | Status | Notes |
|------|--------|--------|
| `dashboard/page.tsx` | Migrated | Uses organizationId, Project status not "lost", Quote status draft/sent; recent projects/quotes use new fields; Sales YTD removed (no Sale model). |

### Reports

| Item | Status | Notes |
|------|--------|--------|
| `reports/page.tsx` | Migrated | effectiveOrgId, clients + STATIC_COUNTRIES; ReportsClient uses new schema (projectName, status lead/won/lost, countryCode). |
| `api/reports/projects` | Migrated | GET returns real data (tenant-scoped); summary; query params: page, limit, status, countryCode, clientId, search, soldFrom, soldTo; format=csv \| xlsx returns file download. try/catch returns empty payload on error. |
| `api/sales/reports/summary` | Stubbed | Returns 200 with stub totals so Reports page does not break. Sales module not migrated. |
| `api/reports/pieces` | Stubbed | Returns empty `byQty`, `byKg`, `byM2`; not used by main reports flow. See route comment. |
| `api/reports/email` | Migrated | POST: to (required), subject, status, countryCode, clientId, soldFrom, soldTo, search; sends CSV report via Resend; buildVbtEmailHtml. |
| Partner Reports export | Done | Export CSV and Export Excel (server-side) with same filters; PDF for quotes remains at /api/quotes/[id]/pdf. |
| Superadmin Analytics export | Done | GET /api/saas/analytics/export?type=leaderboard&format=csv|xlsx&dateFrom&dateTo&sort; Export CSV/Excel in Analytics hub. |

### Sales (entire module)

| Item | Status | Notes |
|------|--------|--------|
| All sales API routes | Stubbed | Return 501 or empty; Sale/SaleInvoice/BillingEntity not in new schema. UI pages still exist; API calls will get 501. |

### Countries / Admin / Inventory / Freight / Tax / Catalog

| Item | Status | Notes |
|------|--------|--------|
| `api/countries/*` | Stubbed | GET returns []; POST/ PATCH/DELETE return 501 (no CountryProfile). Forms use `lib/countries.ts` (STATIC_COUNTRIES). |
| `api/admin/settings` | Migrated | prisma.organization; PATCH may pass unknown fields (Org has no rateS80 etc in new schema). |
| `api/admin/warehouses/*` | Implemented | GET returns array (Superadmin = Vision Latam only; partner = their org). Prefer GET/POST `api/saas/warehouses` (returns `{ warehouses }`) for new code. |
| `api/saas/warehouses` | Migrated | GET/POST; supports `organizationId` for superadmin. Step1 (wizard) and inventory flows use this where applicable. |
| `api/inventory/*` (legacy) | Deprecated | GET/POST, `api/inventory/[id]/move`, `api/inventory/logs` return **410 Gone** with message to use `/api/saas/inventory/*`. |
| `api/saas/inventory/levels`, `api/saas/inventory/transactions` | Migrated | SaaS inventory: levels by org/warehouse; transactions for moves. Partner and Superadmin inventory UIs use these. |
| `api/freight/*`, `api/tax-rules/*` | Stubbed | 501 or empty. |
| `api/catalog/*`, `api/import/*` | Stubbed | 501 or empty (no pieceCatalog/revitImport). |

### Engineering (SaaS backend)

| Item | Status | Notes |
|------|--------|--------|
| `api/saas/engineering/route.ts` | Migrated | GET list, POST create (status draft default); activity log `engineering_request_created`. |
| `api/saas/engineering/[id]/route.ts` | Migrated | GET one, PATCH update (status, assignedToUserId, requestType, wallAreaM2, etc.). |
| `api/saas/engineering/[id]/files/route.ts` | New | POST add file (fileName, fileType, fileSize, fileUrl). |
| `api/saas/engineering/[id]/deliverables/route.ts` | New | POST add deliverable (title, description, fileUrl). |
| Core `packages/core/src/services/engineering.ts` | Extended | create with status draft; updateEngineeringRequest; addEngineeringFile; addDeliverable. Schema: EngineeringRequestStatus + draft/needs_info/rejected; EngineeringFile + fileSize; EngineeringDeliverable + title, description. |
| See | `docs/ENGINEERING-FLOW.md` | States, endpoints, tenant rules. |

### Document Library (SaaS backend)

| Item | Status | Notes |
|------|--------|--------|
| `api/saas/documents/route.ts` | Migrated | GET list (visibility, countryScope), POST create; activity log `document_uploaded`. |
| `api/saas/documents/categories/route.ts` | Existing | GET categories; dynamic force. |
| `api/saas/documents/[id]/route.ts` | New | GET one, PATCH update. |
| Core `packages/core/src/services/documents.ts` | Extended | createDocument, updateDocument. Platform-wide; filtered by visibility and countryScope. |
| See | `docs/DOCUMENT-LIBRARY.md` | Visibility, endpoints, tenant rules. |

### Training (SaaS backend)

| Item | Status | Notes |
|------|--------|--------|
| `api/saas/training/programs/route.ts` | Existing | GET programs (platform-level). |
| `api/saas/training/enrollments/route.ts` | Migrated | GET list (tenant), POST enroll; activity log `training_enrolled`. |
| `api/saas/training/enrollments/[id]/route.ts` | New | PATCH (progressPercent/progressPct, status, completedAt). |
| Core `packages/core/src/services/training.ts` | Existing | listTrainingEnrollments, enrollInProgram, updateEnrollmentProgress. |
| See | `docs/TRAINING-SYSTEM.md` | Programs vs enrollments, tenant rules. |

### Partner Management (SaaS backend)

| Item | Status | Notes |
|------|--------|--------|
| `api/saas/partners/route.ts` | New | GET list (platform superadmin), POST create; activity log partner_created. |
| `api/saas/partners/[id]/route.ts` | New | GET one, PATCH update; activity log partner_updated. |
| `api/saas/partners/[id]/territories/route.ts` | New | GET list, POST add territory; activity log territory_assigned. |
| `api/saas/territories/[id]/route.ts` | New | DELETE remove territory; activity log territory_removed. |
| `api/saas/partners/[id]/onboard/route.ts` | New | GET state, POST/PATCH set onboarding state; activity log partner_onboarded. |
| `api/saas/org-members/route.ts` | New | GET list (active org), POST invite; activity log member_invited. |
| `api/saas/org-members/[id]/route.ts` | New | PATCH role/status, DELETE remove; activity log member_role_changed. |
| Core `packages/core/src/services/partners.ts` | New | listPartners, getPartnerById, createPartner, updatePartner; listPartnerTerritories, addPartnerTerritory, removeTerritory; getPartnerOnboarding, updatePartnerOnboarding. |
| Core `packages/core/src/services/org-members.ts` | New | listOrgMembers, inviteOrgMember, updateOrgMember, removeOrgMember; API role mapping (owner/admin/sales/engineer/viewer). |
| Schema | Extended | PartnerProfile: contactName, contactEmail, onboardingState. |
| See | `docs/PARTNER-SYSTEM.md` | Partner model, territories, onboarding, org members, tenant rules. |

### Analytics and reporting (SaaS backend)

| Item | Status | Notes |
|------|--------|--------|
| `api/saas/analytics/pipeline/route.ts` | New | GET pipeline (projects_total, projects_by_status, quotes_total, quotes_by_status, quotes_value_pipeline/won/lost). Tenant-scoped. |
| `api/saas/analytics/partners/route.ts` | New | GET partner performance (projects_created, quotes_created/sent/accepted, conversion_rate, revenue_total). Filters: dateFrom, dateTo, partnerId, country. |
| `api/saas/analytics/quotes/route.ts` | New | GET quote analytics (counts by status, average_quote_value, conversion_rate, average_sales_cycle_days). Optional dateFrom/dateTo. |
| `api/saas/analytics/leaderboard/route.ts` | New | GET partner leaderboard (partnerName, projects, quotes, revenue, conversionRate). Sort: revenue \| quotes_accepted; limit, dateFrom, dateTo. |
| `api/saas/dashboard/overview/route.ts` | New | GET lightweight overview (projects_total, quotes_total, quotes_pipeline_value, quotes_won_value). |
| `api/saas/dashboard/recent-projects/route.ts` | New | GET recent projects (limit). |
| `api/saas/dashboard/recent-quotes/route.ts` | New | GET recent quotes (limit). |
| `api/saas/dashboard/activity/route.ts` | New | GET recent activity log (limit). |
| Core `packages/core/src/services/analytics.ts` | New | getPipelineAnalytics, getPartnerPerformance, getQuoteAnalytics, getDashboardOverview, getRecentProjects, getRecentQuotes, getDashboardActivity, getPartnerLeaderboard. |
| See | `docs/ANALYTICS-SYSTEM.md` | Endpoints, metrics, tenant rules. |

### Backend hardening (production readiness)

| Item | Status | Notes |
|------|--------|--------|
| Rate limiting | Done | `lib/rate-limit.ts`: analytics 60/min, create_update 20/min, auth 10/min, read 60/min; IP-based; pluggable store (memory default). |
| Caching | Done | `lib/cache.ts` + `withSaaSHandler`: analytics 60s, dashboard 30s, leaderboard 120s; GET only; key = path + query + orgId. |
| Validation | Done | `packages/core/src/validation/`: projects, quotes, engineering, partners, documents, training, analytics; import from `@vbt/core/validation`. |
| Error handling | Done | `lib/api-error.ts`: unified `{ error: { code, message, details } }`; TenantError, ZodError, Prisma, RateLimitExceeded. |
| Indexes | Done | `Quote`: added `@@index([createdAt])` for analytics; run migration. |
| Observability | Done | `lib/api-logger.ts`: structured log (endpoint, method, userId, organizationId, durationMs, status); used in `withSaaSHandler`. |
| SaaS handler | Done | `lib/saas-handler.ts`: `withSaaSHandler({ cacheTtl?, rateLimitTier?, skipRateLimit? }, handler)`; applied to analytics, dashboard, projects, quotes, engineering, documents, partners. |
| See | `docs/BACKEND-HARDENING.md` | Full description, store interfaces, remaining gaps. |

### Activity Log (key events)

| Action | When |
|--------|------|
| `quote_created` | POST /api/saas/quotes |
| `quote_sent` | Quote email sent (api/quotes/[id]/email) |
| `quote_accepted` | PATCH quote status to accepted (api/saas/quotes/[id]) |
| `engineering_request_created` | POST /api/saas/engineering |
| `document_uploaded` | POST /api/saas/documents |
| `training_enrolled` | POST /api/saas/training/enrollments |
| `partner_created` | POST /api/saas/partners |
| `partner_updated` | PATCH /api/saas/partners/[id] |
| `territory_assigned` | POST /api/saas/partners/[id]/territories |
| `territory_removed` | DELETE /api/saas/territories/[id] |
| `partner_onboarded` | POST/PATCH /api/saas/partners/[id]/onboard |
| `member_invited` | POST /api/saas/org-members |
| `member_role_changed` | PATCH /api/saas/org-members/[id] (role change) |

---

## 4. Blockers and risks

- **Sales module:** No new-schema equivalent. Do not delete; hide or gate behind feature flag if needed; document as legacy.
- **Countries:** New schema has no CountryProfile. Use `countryCode` (string) on Client/Project and optional static list in UI.
- **Revit / CSV quote flow:** RevitImport not in new schema. Quote create in new schema has no revitImportId. For Sprint 2, quote create uses new schema only (no CSV/Revit); legacy flow can be stubbed or disabled.
- **Build:** After Projects + Quotes refactors, dashboard and reports may still fail until they are migrated or stubbed.

---

## 5. Changelog

- **Sprint 2:** Audit completed; Projects module migrated (API + UI); Clients API migrated; Dashboard/Reports/Clients page adapted; Sales/Catalog/Import/Inventory/Freight/Tax/Countries stubbed for build; Admin org→organization, User/OrgMember fixes; audit.ts metadataJson cast; build passes.
- **Quote Creation V1:** POST/PATCH/duplicate /api/saas/quotes; core createQuote with items, updateQuote items replace, duplicateQuote; minimal /quotes/create UI; QuotesClient new schema; static countries in `lib/countries.ts`; project new page uses static countries when API empty. See `docs/QUOTE-FLOW-V1.md`.
- **Backend foundation (Engineering, Documents, Training):** Engineering: full workflow (draft/submitted/…/rejected), PATCH, POST files, POST deliverables; schema + draft/needs_info/rejected, fileSize, deliverable title/description. Documents: createDocument, updateDocument; POST/PATCH/GET by id; visibility and countryScope. Training: PATCH enrollments/[id] (progressPercent, status, completedAt); activity log training_enrolled. Activity log: quote_created, quote_sent, quote_accepted, engineering_request_created, document_uploaded, training_enrolled. See `docs/ENGINEERING-FLOW.md`, `docs/DOCUMENT-LIBRARY.md`, `docs/TRAINING-SYSTEM.md`.
- **Partner Management:** Partners (GET/POST /api/saas/partners, GET/PATCH /api/saas/partners/[id]); territories (GET/POST partners/[id]/territories, DELETE /api/saas/territories/[id]); onboarding (GET/POST/PATCH partners/[id]/onboard); org members (GET/POST /api/saas/org-members, PATCH/DELETE org-members/[id]). Core services: partners.ts, org-members.ts. Schema: PartnerProfile + contactName, contactEmail, onboardingState. Activity log: partner_created, partner_updated, territory_assigned, territory_removed, partner_onboarded, member_invited, member_role_changed. Platform superadmin for partner/territory/onboarding; activeOrgId for org members. See `docs/PARTNER-SYSTEM.md`.
- **Analytics and reporting:** Pipeline (GET /api/saas/analytics/pipeline); partner performance (GET /api/saas/analytics/partners, filters dateFrom, dateTo, partnerId, country); quote analytics (GET /api/saas/analytics/quotes); leaderboard (GET /api/saas/analytics/leaderboard, sort revenue \| quotes_accepted); dashboard overview, recent-projects, recent-quotes, activity. Core analytics.ts; tenant-scoped unless platform superadmin. See `docs/ANALYTICS-SYSTEM.md`.
- **Backend hardening:** Rate limiting (analytics 60/min, create_update 20/min, auth 10/min); caching (analytics 60s, dashboard 30s, leaderboard 120s); centralized validation in `packages/core/src/validation` (import `@vbt/core/validation`); unified error body `{ error: { code, message, details } }`; Quote index on `createdAt`; structured API logging (endpoint, userId, organizationId, duration, status). `withSaaSHandler` applied to analytics, dashboard, projects, quotes, engineering, documents, partners. See `docs/BACKEND-HARDENING.md`.
- **Remaining legacy:** Sales UI (pages still call stubbed APIs); Legacy quote wizard `/quotes/new` redirects to `/quotes/create`; Reports projects real data, sales summary stubbed 200; Catalog/Import/Revit flow stubbed.
- **Audit (inventory + warehouses + quotes):** (1) `catalogPieceId` added to quote item validation, core create/update/duplicate, and saas/quotes APIs; UI can send/persist per item. (2) Step1 wizard and inventory flows use `api/saas/warehouses` where applicable; `api/admin/warehouses` kept as legacy array format. (3) Legacy `api/inventory` GET/POST/move/logs return 410; use `api/saas/inventory/*`. (4) `(dashboard)/admin/inventory` redirects to `/inventory`. (5) `/quotes/new` redirects to `/quotes/create`. (6) Reports: `reports/projects` safe (try/catch); `sales/reports/summary` returns 200 stub. (7) Quote item `quantity` validation: min(0). See plan "Auditoría SaaS Inventario y Distribuidores".
- **Partner pricing (no EXW):** Partners must not see factory cost or EXW. Base price = factory cost + Vision Latam commission % (default 20%). Global Settings: added "Vision Latam commission %" in pricing. GET /api/quotes/[id] and GET /api/saas/quotes/[id] mask response for non-superadmin (factoryCostTotal/factoryCostUsd null, basePriceForPartner computed from platform config). Quote detail UI and PDF show "Base price (Vision Latam)" when basePriceForPartner is present. PDF route also enforces org scope and masks for partners. See docs/FRONTEND-AUDIT.md.
- **Follow-up (migration + E2E auth):** Prisma migration for `platform_config` added (`migrations/20250313000000_add_platform_config/migration.sql` + `migration_lock.toml`). E2E auth flows: `e2e/auth-flows.spec.ts` (superadmin dashboard/reports, partner nav without Sales/Admin when `E2E_*` env set). DEPLOY.md updated with E2E env vars.
- **Dual-portal implementation (Fase 1–5):** (1) Reports: access restricted to org_admin/SUPERADMIN via reports layout and sidebar roles; email report restricted to org_admin/superadmin in API and UI (`canSendReport`). (2) Global Settings: PlatformConfig model and table; core getPlatformConfig/updatePlatformConfig; GET/PATCH /api/saas/platform-config; GlobalSettingsClient (pricing defaults, module visibility); Partner Parameters tab shows platform defaults when no override. (3) Pending page: improved copy and sign-out link. (4) docs/DEPLOY.md env and deploy checklist; Playwright e2e smoke tests (login, dashboard/superadmin/reports redirect when unauthenticated); build passes; playwright.config and e2e excluded from Next.js tsconfig. (5) api/reports/pieces documented as stubbed; MODULE-MIGRATION-STATUS and changelog updated.

---

## 6. Portal implementation status (Superadmin + Partner)

Dual-portal product: see **`docs/FRONTEND-ARCHITECTURE-PLAN.md`** for full IA and roadmap.

### Superadmin portal (`/superadmin/*`)

| Feature | Status | Notes |
|--------|--------|-------|
| Layout + sidebar | Done | SuperadminSidebar; redirect when not superadmin. |
| Dashboard | Done | KPIs (projects, quotes, pipeline, won); partner leaderboard; link to analytics. |
| Partners | Done | List, new, detail (Overview, Team, Territories, Onboarding, Parameters placeholder), edit; invite by email (POST partners/[id]/invite). |
| Analytics hub | Done | Pipeline, quote analytics, partner performance, leaderboard; filters (date, partner, country). |
| Activity | Done | Global activity feed (`/superadmin/activity`). |
| Document library admin | Done | List, create, edit; filters (category, visibility). |
| Training admin | Done | Programs list; enrollments list (with org name). |
| Global settings | Done | GlobalSettingsClient: pricing defaults (margin %, entry fee, training fee), module visibility toggles; GET/PATCH /api/saas/platform-config; PlatformConfig model; link to Partners. Partner Parameters tab shows “(Default: X)” for fields with platform default when partner has no override. |
| Context switcher | Done | TopBar “View as” dropdown; cookie `vbt-active-org`; redirect to /dashboard or /superadmin/dashboard. |
| Partner parameters (overrides) | Done | Tab in partner detail: fees, margins, targets, agreement; PATCH partners/[id] + core updatePartner. |
| Global Reports | Done | `/superadmin/reports`: KPIs (projects, quotes, pipeline, won/lost), date filter, partner leaderboard, Export CSV/Excel, link to Analytics. |

### Partner portal (dashboard `/(dashboard)/*`)

| Feature | Status | Notes |
|--------|--------|-------|
| Sidebar | Done | Dashboard, Projects, Clients, Quotes, Engineering, Documents, Training, Sales (SUPERADMIN only), Reports, Settings (Overview, Team), Inventory (SUPERADMIN only), Admin (SUPERADMIN only). |
| effectiveOrgId | Done | Root and dashboard layout use `getEffectiveActiveOrgId`; pages (dashboard, projects, clients, quotes, reports) use it for data. |
| Engineering | Done | List, detail, new request; status filter. |
| Documents | Done | Read-only list (GET /api/saas/documents). |
| Training | Done | My enrollments; available programs; Enroll button (POST enrollments; API uses getTenantContext for cookie). |
| Settings hub | Done | `/settings` (Overview, Team, placeholders for Warehouses/Freight/Tax/Pricing). |
| Team | Done | `/settings/team`: list members, invite by email (POST org-members with email); only org_admin or SUPERADMIN can invite; Settings nav and routes protected by role. |
| TopBar org name | Done | Shows `activeOrgName` when in partner context. |
| Role-based nav | Done | Settings visible only to org_admin and SUPERADMIN; layout passes SUPERADMIN when isPlatformSuperadmin. |
| Settings route protection | Done | `(dashboard)/settings/layout.tsx` redirects to /dashboard if not org_admin and not SUPERADMIN. |
| Admin/Inventory restriction | Done | Nav: Inventory and Admin visible only to SUPERADMIN. `(dashboard)/admin/layout.tsx` redirects non-superadmin to /dashboard. |
| Reports access | Done | `/reports` and Reports nav visible only to org_admin and SUPERADMIN; `(dashboard)/reports/layout.tsx` redirects others to /dashboard. |
| Email report permission | Done | POST /api/reports/email: only org_admin or platform superadmin may send; 403 otherwise. ReportsClient receives `canSendReport` and hides “Email report” when false. |
| Pending page | Done | `/pending`: clearer copy, sign-out link; copy explains “pending assignment to an organization”. |
| Deploy checklist | Done | `docs/DEPLOY.md`: required env (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL); optional RESEND_*, SUPERADMIN_*; pre/post-deploy checklist. |
| Legacy API refs in Reports | Done | ReportsClient calls api/reports/pieces (200 empty) and api/sales/reports/summary (501); catch leaves salesSummary null so Sales KPIs block is hidden; Sales/Admin/Inventory nav and pages are SUPERADMIN-only so no partner sees 501. |
| Partner pricing (no EXW) | Done | Partners never see factory cost or EXW. Base price = factory cost + Vision Latam commission % (Global Settings). GET quote (legacy + SaaS) and PDF mask: return basePriceForPartner, null factory cost. UI and PDF show "Base price (Vision Latam)" for partners. |

### Recommended next steps (after deploy)

- **Invitation acceptance (optional):** Token-based invite link so new users land in the right org after signup (see plan Fase 3.2).
- **E2E with auth:** Done. `e2e/auth-flows.spec.ts`: when `E2E_SUPERADMIN_EMAIL`/`E2E_SUPERADMIN_PASSWORD` are set, tests sign in and assert Superadmin dashboard and Global Reports export; when `E2E_PARTNER_EMAIL`/`E2E_PARTNER_PASSWORD` are set, tests assert partner dashboard and that Sales/Admin are not in nav.
- **Apply schema in production:** Done. Migration added: `packages/db/prisma/migrations/20250313000000_add_platform_config/migration.sql` and `migration_lock.toml`. Run `npx prisma migrate deploy` in production (or `db push` if not using migrate).

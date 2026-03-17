# SaaS Foundation – Partner Platform (Vision Latam)

This document describes the **session structure**, **tenant scoping**, **RBAC**, **migration notes**, and **service layout** for the multi-tenant partner SaaS backend.

---

## 1. Session structure

Session (JWT) and `session.user` contain:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User ID (same as `userId`) |
| `userId` | string | User ID |
| `email` | string \| null | User email |
| `name` | string \| null | User full name |
| `activeOrgId` | string \| null | Currently active organization for tenant scoping |
| `activeOrgName` | string \| null | Display name of active org |
| `role` | string | Role in the **active** organization: `org_admin` \| `sales_user` \| `technical_user` \| `viewer` |
| `roles` | string[] | Array with the active org role (one active org per session) |
| `isPlatformSuperadmin` | boolean | If true, user can access all organizations and manage permissions |
| `orgId` | string \| null | **Deprecated.** Use `activeOrgId`. Kept for backward compat. In code use `getEffectiveOrganizationId(user)` for current org. DB column is always `organization_id`; Prisma field is `organizationId`. |
| `orgSlug` | string \| null | **Deprecated.** Use `activeOrgName`. |

- **One active org per session:** A user may belong to multiple organizations; the session holds one `activeOrgId` (e.g. first membership). Switching org can be added later (e.g. API to set active org).
- **Platform superadmin:** Independent of org membership; can act across all tenants and manage user/org permissions.

---

## 2. Tenant scoping strategy

- **Operational data** (projects, quotes, clients, engineering requests, training enrollments, etc.) are scoped by **organization** (`organizationId`).
- **Queries must always** filter by the tenant except when the caller is a platform superadmin doing cross-tenant operations.
- **Never trust client input for `organizationId`.** Always derive tenant scope from the session (e.g. `activeOrgId`) or from existing records (e.g. project’s organizationId).
- **Helpers** in `apps/web/src/lib/tenant.ts`:
  - `requireSession()` – ensure user is signed in.
  - `requireActiveOrg()` – ensure user has an active org or is superadmin.
  - `requireOrgRole(role | roles)` – ensure user has one of the given roles in the active org (or is superadmin).
  - `assertOrgAccess(organizationId)` – ensure user can access that org (active org match or superadmin).
  - `getTenantContext()` – get `{ userId, activeOrgId, role, roles, isPlatformSuperadmin }` for use in services.
- **Core services** (`packages/core/src/services/*`) accept a **tenant context** `{ userId, organizationId, isPlatformSuperadmin }`. They use `orgScopeWhere(ctx)` so that:
  - Non-superadmin: always filter by `ctx.organizationId`.
  - Superadmin with `organizationId` set: filter by that org.
  - Superadmin with `organizationId` null: no org filter (cross-tenant).

---

## 3. RBAC approach

- **Org-level roles** (in `org_members.role`): `org_admin`, `sales_user`, `technical_user`, `viewer`.
- **Platform-level:** `users.is_platform_superadmin` – can access all orgs and manage permissions.
- **Enforcement:** Use `requireOrgRole(['org_admin', 'sales_user'])` (or similar) in API routes and server actions before performing sensitive operations. Use `requirePlatformSuperadmin()` for platform-only actions (e.g. manage any org’s users).
- **Session:** The active org’s role is in `session.user.role` and `session.user.roles`; use these for UI and for route-level checks.

---

## 4. Migration notes

- **Schema:** The active Prisma schema is the **Partner SaaS** model (`packages/db/prisma/schema.prisma`). The previous schema is backed up in `schema.legacy.prisma`.
- **Data:** Applying migrations against a DB that was created with the legacy schema will **drop** old tables and **create** new ones. No automatic data migration. See `docs/MIGRATION-RISKS.md`.
- **Auth:** Login and signup use the new `User` / `Organization` / `OrgMember` models. Session shape is as in §1.
- **Audit:** Legacy `createAuditLog` is kept for compatibility; new code should use `createActivityLog` (writes to `activity_logs` with string `action` and `metadataJson`).
- **Existing routes/pages:** Use `getEffectiveOrganizationId(user)` for tenant scope; DB column is `organization_id`, Prisma field is `organizationId`. New **SaaS** endpoints live under **`/api/saas/*`** and use the new services and schema.

---

## 5. Service module layout

Services live in **`packages/core/src/services/`** and are re-exported from `@vbt/core`:

| Module | Purpose |
|--------|--------|
| `tenant-context.ts` | `TenantContext` type and `orgScopeWhere(ctx)` for safe org filtering. |
| `projects.ts` | `listProjects`, `getProjectById`, `createProject`, `updateProject` (all tenant-scoped). |
| `quotes.ts` | `listQuotes`, `getQuoteById`, `createQuote`, `updateQuote` (tenant-scoped). |
| `engineering.ts` | `listEngineeringRequests`, `getEngineeringRequestById`, `createEngineeringRequest`, `updateEngineeringRequestStatus` (tenant-scoped). |
| `documents.ts` | `listDocumentCategories`, `listDocuments`, `getDocumentById` (platform-wide; filter by visibility/country). |
| `training.ts` | `listTrainingPrograms`, `getTrainingProgramById` (platform-wide); `listTrainingEnrollments`, `enrollInProgram`, `updateEnrollmentProgress` (tenant-scoped). |

- **Call pattern:** Route handlers get session/tenant context (e.g. via `getTenantContext()` or `requireActiveOrg()`), build a core `TenantContext` with `organizationId: session.activeOrgId`, and pass it plus `prisma` into the service. Services never accept `organizationId` from the client.
- **Superadmin:** When `ctx.isPlatformSuperadmin` is true and `ctx.organizationId` is null, list services return data for all orgs; when `organizationId` is set, they filter by that org.

---

## 6. New SaaS API routes (minimal CRUD)

All under **`/api/saas/`**; use tenant helpers and core services.

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/saas/projects` | List (tenant-scoped) / create project |
| GET/PATCH | `/api/saas/projects/[id]` | Get / update project |
| GET/POST | `/api/saas/quotes` | List / create quote |
| GET | `/api/saas/quotes/[id]` | Get quote |
| GET/POST | `/api/saas/engineering` | List / create engineering request |
| GET | `/api/saas/engineering/[id]` | Get engineering request |
| GET | `/api/saas/documents` | List documents (platform; filter by query params) |
| GET | `/api/saas/documents/categories` | List document categories |
| GET | `/api/saas/training/programs` | List training programs |
| GET/POST | `/api/saas/training/enrollments` | List enrollments (tenant-scoped) / enroll |

These routes return 401/403 via `TenantError` and `tenantErrorStatus()` when the user is unauthenticated or lacks the required org/role.

# Migration Risks: Legacy schema → Partner SaaS schema

## Summary

The **active** Prisma schema has been switched from the legacy single-tenant model to the **Partner SaaS** multi-tenant model. This document describes compatibility and migration risks.

## What was done

1. **Backup:** The previous schema is preserved in `packages/db/prisma/schema.legacy.prisma`.
2. **Active schema:** `packages/db/prisma/schema.prisma` now contains the Partner SaaS schema (same content as `schema.partner-saas.prisma`).
3. **No data migration:** No script has been run to copy or transform existing database data.

## ⚠️ Destructive migration warning

- The **legacy** schema uses tables such as: `orgs`, `users` (with `name`, `status` enum), `org_members` (with `orgId`, `role` enum), `clients`, `projects`, `quotes`, `quote_lines`, `audit_logs`, `sales`, `piece_catalog`, `warehouses`, etc.
- The **Partner SaaS** schema uses: `organizations`, `users` (with `full_name`, `is_active`, `is_platform_superadmin`), `org_members` (with `organization_id`, `role` enum), `clients`, `projects`, `quotes`, `quote_items`, `activity_logs`, and **no** `sales` / `piece_catalog` / `warehouses` in the new schema.

If you run **`prisma migrate dev`** against an existing database that was created with the legacy schema:

- Prisma will generate a migration that **drops** legacy tables and **creates** the new tables.
- **All existing data in those tables will be lost** unless you:
  - Export data before migrating, or
  - Write and run a custom data migration (e.g. seed or SQL) that reads from the old tables and writes to the new ones **before** dropping the old schema, or
  - Use a separate database for the new schema and never point the app at the old DB again.

## Recommended approach

1. **New / empty database (no legacy data to keep)**  
   - Run `pnpm db:generate` then `pnpm db:migrate` (or `prisma migrate dev` from `packages/db`).  
   - Then run `pnpm db:seed` to create the initial Vision Latam org and superadmin user.

2. **Existing database with data you care about**  
   - **Do not** run `prisma migrate dev` until you have a plan.  
   - Options:  
     - Restore `schema.legacy.prisma` as `schema.prisma`, export data, then switch again to the Partner SaaS schema, create a new migration, and run a custom script to backfill from the export.  
     - Or: use a **new** database URL for the Partner SaaS app and leave the old DB untouched; migrate data later with a one-off ETL if needed.

## Compatibility after schema switch

- **Auth:** `apps/web/src/lib/auth.ts` and signup/seed assume the **new** models: `User` (`fullName`, `isActive`, `isPlatformSuperadmin`), `Organization`, `OrgMember` (`organizationId`, `role` as `OrgMemberRole`). The legacy `Org`, `User.status`, `OrgMemberRole` (SUPERADMIN, ADMIN, etc.) are gone.
- **APIs:** Existing API routes (e.g. `api/projects`, `api/clients`, `api/quotes`) still reference the **old** Prisma model (e.g. `orgId`, `Org`, `ProjectStatus` values). They will **break** after `prisma generate` until updated to use the new schema (e.g. `organizationId`, `Organization`, new enums).
- **Audit:** Legacy code uses `createAuditLog` with `AuditAction` enum; the new schema uses `ActivityLog` with a string `action` and `metadataJson`. The audit helper must be updated to use the new model.

## Build status after foundation work

- **Schema:** Active schema is Partner SaaS. `pnpm db:generate` succeeds.
- **New code:** Auth (`lib/auth.ts`), tenant helpers (`lib/tenant.ts`), core services (`packages/core/src/services/*`), and `/api/saas/*` routes use the new schema and session shape.
- **Existing app:** Many dashboard pages and API routes under `/api/*` (e.g. `/api/projects`, `/api/clients`, `/api/quotes`, `/api/sales`) still reference the **legacy** model (`orgId`, `Org`, `CountryProfile`, `QuoteLine`, `Sale`, etc.). Until those are updated to `organizationId` and the new models, **the full app build may fail**. Use the new **`/api/saas/*`** endpoints and the docs in **`docs/SAAS-FOUNDATION.md`** for the partner SaaS foundation. Migrate legacy routes and pages incrementally (replace `orgId` with `organizationId`, update model names and enums, remove references to dropped tables).

## Next steps (implementation order)

1. Run **`pnpm db:generate`** from repo root so the Prisma client matches the new schema.
2. If the database is empty or disposable: run **`prisma migrate dev`** from `packages/db` to create the Partner SaaS tables.
3. Run the **new seed** (see `packages/db/prisma/seed.ts`) to create the default organization and superadmin.
4. Update **auth**, **tenant helpers**, **core services**, and **API routes** to use the new models and session shape (as in the rest of the SaaS foundation work).

# Codebase cleanup and obsolete references

## Files kept on purpose (do not delete)

| Path | Reason |
|------|--------|
| `packages/db/prisma/schema.legacy.prisma` | Backup of pre–Partner SaaS schema; referenced in docs for migration/rollback. Not used by Prisma CLI (active schema is `schema.prisma`). |
| `packages/db/prisma/schema.partner-saas.prisma` | Historical copy of Partner SaaS schema; docs reference it. Active schema is `schema.prisma`. |
| `packages/db/prisma/*.sql` (e.g. `backfill-in-conversation-to-quote-sent.sql`, `neon-add-enum-values.sql`) | One-off migration/backfill scripts; keep for history. |

## Deprecated but still in use (migrate when possible)

| Item | Location | Note |
|------|----------|------|
| `createAuditLog` | `lib/audit.ts` | Kept as deprecated wrapper; all API routes now use `createActivityLog` directly. Can be removed once no external code references it. |
| `orgId` / `orgSlug` on session | `types/next-auth.d.ts`, `lib/auth.ts` | Marked @deprecated; use `activeOrgId` / `activeOrgName`. Use `getEffectiveOrganizationId(user)` for current org. Convention: DB = `organization_id`, Prisma = `organizationId`, session = `activeOrgId`. |

## Cleanup completed

- **createAuditLog**: Replaced with `createActivityLog` in `api/quotes/[id]/route.ts`, `api/quotes/[id]/email/route.ts`, `api/admin/users/[id]/route.ts`. Import removed from `api/quotes/route.ts`.
- **packages/db/src/normalizer.ts**: Removed (was not exported or used).
- **Legacy inventory API routes**: Removed `api/inventory/route.ts`, `api/inventory/[id]/move/route.ts`, `api/inventory/logs/route.ts` (deprecated; use `/api/saas/inventory/*`).
- **docs/ERD-ESTRUCTURA-ACTUAL.md**: Replaced by `docs/ERD-LEGACY.md` with legacy notice. Old file deleted.
- **docs/MODULE-MIGRATION-STATUS.md**: Updated Warehouses/Inventory line (warehouses are in new schema).
- **packages/db/prisma/scripts/verify-and-clean-neon.ts**: `EXPECTED_TABLES` updated to include `inventory_levels`, `inventory_transactions`, `catalog_pieces`, `countries`, `freight_profiles`, `tax_rule_sets`.

## Console usage

- `lib/api-logger.ts`: `console.warn` / `console.info` for request logging (intentional).
- API routes (signup, invite, user notification, quote email): `console.warn` on email send failure only. No removal needed.

## Build and lint

- Run `pnpm run build` and `pnpm run lint` before commit. Fix type and lint errors; avoid committing commented-out blocks or dead code.

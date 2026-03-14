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
| `createAuditLog` | `lib/audit.ts` | Wrapper around `createActivityLog`; used by `api/quotes/[id]`, `api/admin/users/[id]`, `api/quotes/[id]/email`. Prefer `createActivityLog` for new code. |
| `orgId` / `orgSlug` on session | `types/next-auth.d.ts`, `lib/auth.ts` | Marked @deprecated; use `activeOrgId` / `activeOrgName`. Still populated for backward compatibility. |

## Console usage

- `lib/api-logger.ts`: `console.warn` / `console.info` for request logging (intentional).
- API routes (signup, invite, user notification, quote email): `console.warn` on email send failure only. No removal needed.

## Build and lint

- Run `pnpm run build` and `pnpm run lint` before commit. Fix type and lint errors; avoid committing commented-out blocks or dead code.

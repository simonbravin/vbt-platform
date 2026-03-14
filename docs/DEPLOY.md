# Deployment checklist

Use this checklist when deploying the VBT Cotizador (dual portal: Superadmin + Partner) to production.

## Required environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js session signing | Random string (e.g. `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Canonical URL of the app (no trailing slash) | `https://app.example.com` |

## Optional but recommended

| Variable | Description | Used for |
|----------|-------------|----------|
| `RESEND_API_KEY` | Resend.com API key | Sending emails: invites, report email, quote email, signup notifications |
| `RESEND_FROM_EMAIL` | From address for transactional emails | Override default (e.g. `noreply@yourdomain.com`) |
| `SUPERADMIN_EMAIL` | Email of the platform superadmin user | Seed and signup notification target; user must exist or be created with `isPlatformSuperadmin: true` |
| `SUPERADMIN_PASSWORD` | Password for seed-created superadmin | Only used when running `prisma db seed`; change after first login |

## Pre-deploy checklist

1. **Database**
   - Run migrations: `cd packages/db && npx prisma migrate deploy`
   - Or push schema: `npx prisma db push` (dev/staging only)
   - Optionally run seed: `npx prisma db seed` (creates superadmin if `SUPERADMIN_EMAIL` exists)

2. **Environment**
   - Set all required variables in the host (Vercel, etc.).
   - Ensure `NEXTAUTH_URL` matches the production domain.

3. **Build**
   - From repo root: `pnpm run build` (or `pnpm install && pnpm run build`).
   - Fix any TypeScript or lint errors before deploying.

## Post-deploy verification

- [ ] Login as superadmin → access `/superadmin/*` (Analytics, Partners, Settings, Reports).
- [ ] Login as partner user → access `/dashboard`, no Sales/Admin in sidebar; Reports only if org_admin.
- [ ] Superadmin context switch: set `vbt-active-org` cookie to a partner org ID and confirm data scopes.
- [ ] Reports: export CSV/Excel, and (if org_admin) send report by email (requires `RESEND_API_KEY`).
- [ ] Global Settings: superadmin can load and save pricing defaults and module visibility.

## E2E tests (optional)

- From repo root: `cd apps/web && pnpm test:e2e` (smoke: login page, unauthenticated redirects).
- **Auth flows** (optional): set `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD` and optionally `E2E_PARTNER_EMAIL`, `E2E_PARTNER_PASSWORD` to run signed-in tests (superadmin dashboard/reports, partner nav without Sales/Admin).
- First time: `cd apps/web && npx playwright install` to install browsers.

## Notes

- Platform config (Global Settings) is stored in the `platform_config` table; one row is created on first save. If you use `prisma migrate deploy`, ensure a migration exists for `platform_config`, or run `npx prisma db push` once to create the table.
- Partner parameters override global defaults per partner; defaults are shown in the Parameters tab when editing a partner.

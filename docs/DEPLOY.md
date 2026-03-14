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
| `RESEND_API_KEY` | Resend.com API key | Sending emails: invites, report email, quote email, signup notifications, **forgot password** |
| `RESEND_FROM_EMAIL` | From address for transactional emails | Override default (e.g. `noreply@yourdomain.com`) |
| `SUPERADMIN_EMAIL` | Email of the platform superadmin user | Seed and signup notification target; user must exist or be created with `isPlatformSuperadmin: true` |
| `SUPERADMIN_PASSWORD` | Password for seed-created superadmin | Only used when running `prisma db seed`; change after first login |

## Pre-deploy checklist

1. **Database (obligatorio)**
   - **Ejecutar migraciones:** `cd packages/db && npx prisma migrate deploy`
   - Incluye: `platform_config`, `password_reset_tokens`, y **alineación de la tabla `users`** (`full_name`, `password_hash`, etc.). Sin esto, Neon (o cualquier DB creada con otro esquema) no coincide con Prisma y la app puede fallar.
   - **Verificar esquema** después de desplegar: `cd packages/db && pnpm run verify-users-schema` (comprueba que `users` tenga las columnas requeridas).
   - En desarrollo local puedes usar `npx prisma db push` (no sustituye a migrate deploy en producción).
   - Opcional: `npx prisma db seed` (crea/actualiza superadmin si existe `SUPERADMIN_EMAIL`).

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

## Ver usuarios en Neon y corregir superadmin

Para **listar todos los usuarios** en la base (Neon u otra) y ver quién es superadmin:

```bash
cd packages/db
# Usa el .env que tenga DATABASE_URL apuntando a Neon
pnpm run check-users
```

Salida: email, nombre, `isActive`, `isPlatformSuperadmin` de cada usuario.

Si **simon@visionbuildingtechs.com** no existe o no puede entrar (inactivo / no superadmin / contraseña incorrecta):

1. **Crear o activar superadmin y fijar contraseña:**
   ```bash
   cd packages/db
   FIX_SUPERADMIN=1 NEW_PASSWORD="TuClaveSegura" pnpm run check-users
   ```
   Esto crea el usuario si no existe (con ese email) o actualiza `isActive`, `isPlatformSuperadmin` y la contraseña si ya existe.

2. **O ejecutar el seed** (crea/actualiza solo el usuario con `SUPERADMIN_EMAIL`):
   ```bash
   cd packages/db
   SUPERADMIN_EMAIL=simon@visionbuildingtechs.com SUPERADMIN_PASSWORD="TuClave" pnpm run seed
   ```

**Registro desde la app:** Quien se registra por el formulario de signup se crea como **usuario pendiente** (`isActive: false`, rol `viewer`, estado `invited` en la org Vision Latam). No se crea como superadmin. Un superadmin debe activar/aprobar al usuario desde Admin o asignar manualmente en la DB. El único superadmin es el que se define por seed o con el script `check-users` (FIX_SUPERADMIN).

## Notes

- Platform config (Global Settings) is stored in the `platform_config` table; one row is created on first save. If you use `prisma migrate deploy`, ensure a migration exists for `platform_config`, or run `npx prisma db push` once to create the table.
- Partner parameters override global defaults per partner; defaults are shown in the Parameters tab when editing a partner.
- **Esquema de `users`:** La migración `20250313200000_align_users_table_with_schema` deja la tabla `users` alineada con Prisma (columnas `full_name`, `password_hash`, `is_active`, `is_platform_superadmin`, etc.). Si la DB tenía `name` en lugar de `full_name` o `passwordHash` en lugar de `password_hash`, la migración renombra o añade lo necesario. Es obligatorio ejecutar `prisma migrate deploy` en producción.
- **Resiliencia en APIs:** Las rutas de dashboard y analytics tienen try/catch que devuelven datos vacíos/ceros ante errores inesperados (logs en servidor). El comportamiento correcto depende de que el esquema esté alineado vía migraciones.

## Partner goals (objetivos anuales)

- **Configuración:** Los objetivos por partner (meta USD anual y opcional m²) se configuran en **Superadmin → Partners → [Partner] → pestaña Parameters**. También se muestran en la pestaña Overview del detalle del partner (solo lectura, con enlace "Edit in Parameters").
- **Dashboard del partner:** El dashboard del partner muestra un KPI "Sales goal (YTD)" con barra de progreso. Los datos provienen de `GET /api/saas/dashboard/goal` (meta desde `PartnerProfile`, ventas YTD = suma de `totalPrice` de cotizaciones aceptadas en el año en curso).
- **FOB (futuro):** La métrica de ventas YTD puede sustituirse más adelante por **FOB** (factory cost + comisión Vision Latam + parte cedida a distribución/comercialización) cuando se defina el cálculo; el contrato del endpoint y la UI (meta vs avance) se mantienen.

## Partner creation and invitation flow

- **Create partner (Superadmin → Partners → Create partner):** Al crear un partner podés marcar **"Send invitation email to contact"**. Si el contacto tiene email y la casilla está marcada, después de crear la organización se envía automáticamente una invitación a ese email.
- **Si el usuario ya existe:** Recibe un email tipo "You've been added to [Partner Name]". Puede iniciar sesión con su cuenta existente y ver la org del partner.
- **Si el usuario no existe:** Se crea un registro en `partner_invites` y se envía un email con enlace **"Create account"** a `/invite/accept?token=...`. Al hacer clic, la persona completa nombre y contraseña, se crea el usuario y se lo asocia a la org del partner como **owner**. Luego puede iniciar sesión y acceder al portal del partner.
- **Invite desde Team:** En el detalle del partner, pestaña **Team**, "Invite by email" funciona igual: si el email ya tiene cuenta → se agrega a la org y se envía "you've been added"; si no → se envía el link para crear cuenta. Las invitaciones pendientes expiran en 7 días.
- **Migración:** La tabla `partner_invites` se crea con la migración `20250314000000_add_partner_invites`. Ejecutar `npx prisma migrate deploy` en `packages/db` para aplicarla.

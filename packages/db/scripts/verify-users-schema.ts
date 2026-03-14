/**
 * Verify that the `users` table matches the Prisma schema (e.g. after deploying to Neon).
 * Run from repo root:
 *   cd packages/db && pnpm run verify-users-schema
 *
 * Required columns: full_name, password_hash, is_active, is_platform_superadmin.
 * If any are missing, run: npx prisma migrate deploy
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REQUIRED_COLUMNS = [
  "full_name",
  "password_hash",
  "is_active",
  "is_platform_superadmin",
  "email",
  "created_at",
  "updated_at",
];

async function main() {
  const result = await prisma.$queryRaw<
    { column_name: string }[]
  >`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
  `;
  const existing = new Set(result.map((r) => r.column_name));
  const missing = REQUIRED_COLUMNS.filter((c) => !existing.has(c));

  if (missing.length > 0) {
    console.error("\n❌ Tabla `users` no alineada con el schema de Prisma.");
    console.error("   Columnas faltantes:", missing.join(", "));
    console.error("\n   Ejecuta la migración:");
    console.error("   cd packages/db && npx prisma migrate deploy\n");
    process.exit(1);
  }

  console.log("\n✅ Tabla `users` tiene las columnas requeridas (full_name, password_hash, etc.).\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

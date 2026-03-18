/**
 * Verify Neon DB: list expected vs current tables, drop obsolete, ensure schema, clean data.
 * Keeps only superadmin (SUPERADMIN_EMAIL) and partner simon@visionbuildingtechs.com.
 *
 * Run: pnpm --filter @vbt/db run verify-neon
 *
 * Expected tables (from schema.prisma): users, password_reset_tokens, organizations,
 * warehouses, org_members, partner_profiles, partner_invites, partner_territories,
 * clients, contacts, projects, project_claims, quotes, quote_items, engineering_requests,
 * engineering_files, engineering_deliverables, document_categories, documents,
 * training_programs, training_modules, training_enrollments, activity_logs, platform_config.
 * Plus _prisma_migrations (not in schema, used by Prisma).
 */
import { PrismaClient } from "../../../../apps/web/.prisma/client";

const prisma = new PrismaClient();

// Tables required by current Prisma schema (@@map names)
const EXPECTED_TABLES = [
  "users",
  "password_reset_tokens",
  "organizations",
  "warehouses",
  "inventory_levels",
  "inventory_transactions",
  "org_members",
  "partner_profiles",
  "partner_invites",
  "partner_territories",
  "clients",
  "contacts",
  "projects",
  "project_claims",
  "quotes",
  "quote_items",
  "engineering_requests",
  "engineering_files",
  "engineering_deliverables",
  "document_categories",
  "documents",
  "training_programs",
  "training_modules",
  "training_enrollments",
  "activity_logs",
  "countries",
  "freight_profiles",
  "tax_rule_sets",
  "catalog_pieces",
  "platform_config",
] as const;

// Tables known obsolete (dropped from app, safe to remove from DB)
const OBSOLETE_TABLES = ["orgs"];

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "admin@visionbuildingtechs.com";
const PARTNER_EMAIL = "simon@visionbuildingtechs.com";

async function getCurrentTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  return rows.map((r) => r.tablename);
}

async function dropTableIfExists(tableName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
}

async function main() {
  console.log("📋 1. Listing current tables in Neon (public schema)...\n");
  const current = await getCurrentTables();
  const currentSet = new Set(current);

  const missing = EXPECTED_TABLES.filter((t) => !currentSet.has(t));
  const obsolete = current.filter(
    (t) => t !== "_prisma_migrations" && !EXPECTED_TABLES.includes(t as any)
  );

  console.log("Expected tables (from schema):", EXPECTED_TABLES.length);
  console.log("Current tables in DB:", current.length);
  if (missing.length > 0) {
    console.log("\n❌ Missing tables (run: pnpm exec prisma migrate deploy):", missing);
  } else {
    console.log("\n✅ All expected tables exist.");
  }
  if (obsolete.length > 0) {
    console.log("\n🗑️ Obsolete tables (will drop):", obsolete);
  } else {
    console.log("\n✅ No obsolete tables.");
  }

  console.log("\n📋 2. Dropping obsolete tables...");
  for (const table of obsolete) {
    if (!OBSOLETE_TABLES.includes(table)) {
      console.log("   Dropping (not in schema):", table);
      await dropTableIfExists(table);
    }
  }
  for (const table of OBSOLETE_TABLES) {
    if (currentSet.has(table)) {
      console.log("   Dropping (known obsolete):", table);
      await dropTableIfExists(table);
    }
  }

  console.log("\n📋 3. Data cleanup: keep only superadmin +", PARTNER_EMAIL);
  const superadmin = await prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL.toLowerCase() } });
  const partner = await prisma.user.findUnique({ where: { email: PARTNER_EMAIL.toLowerCase() } });

  if (!superadmin) {
    throw new Error(`Superadmin not found: ${SUPERADMIN_EMAIL}. Run seed first.`);
  }
  if (!partner) {
    throw new Error(`Partner not found: ${PARTNER_EMAIL}.`);
  }

  const keepUserIds = [superadmin.id, partner.id];
  const memberships = await prisma.orgMember.findMany({
    where: { userId: { in: keepUserIds } },
    select: { organizationId: true },
  });
  const keepOrgIds = [...new Set(memberships.map((m) => m.organizationId))];
  console.log("   Keep users:", keepUserIds.length, "| Keep orgs:", keepOrgIds.length);

  const usersToDeleteIds = await prisma.user.findMany({
    where: { id: { notIn: keepUserIds } },
    select: { id: true },
  }).then((u) => u.map((x) => x.id));
  if (usersToDeleteIds.length > 0) {
    try {
      await prisma.passwordResetToken.deleteMany({
        where: { userId: { in: usersToDeleteIds } },
      });
    } catch {
      // table may not exist
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.trainingEnrollment.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.warehouse.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });

    const quotesToDelete = await tx.quote.findMany({
      where: { organizationId: { notIn: keepOrgIds } },
      select: { id: true },
    });
    const quoteIds = quotesToDelete.map((q) => q.id);
    if (quoteIds.length > 0) {
      await tx.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
      await tx.quote.deleteMany({ where: { id: { in: quoteIds } } });
    }

    const engRequests = await tx.engineeringRequest.findMany({
      where: { organizationId: { notIn: keepOrgIds } },
      select: { id: true },
    });
    const erIds = engRequests.map((e) => e.id);
    if (erIds.length > 0) {
      await tx.engineeringDeliverable.deleteMany({ where: { engineeringRequestId: { in: erIds } } });
      await tx.engineeringFile.deleteMany({ where: { engineeringRequestId: { in: erIds } } });
      await tx.engineeringRequest.deleteMany({ where: { id: { in: erIds } } });
    }

    const projectsToDelete = await tx.project.findMany({
      where: { organizationId: { notIn: keepOrgIds } },
      select: { id: true },
    });
    const projectIds = projectsToDelete.map((p) => p.id);
    if (projectIds.length > 0) {
      await tx.projectClaim.deleteMany({ where: { projectId: { in: projectIds } } });
      await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    }

    await tx.client.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.partnerProfile.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.partnerTerritory.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.partnerInvite.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.orgMember.deleteMany({ where: { organizationId: { notIn: keepOrgIds } } });
    await tx.orgMember.deleteMany({ where: { userId: { notIn: keepUserIds } } });
    await tx.organization.deleteMany({ where: { id: { notIn: keepOrgIds } } });
    await tx.user.deleteMany({ where: { id: { notIn: keepUserIds } } });
  });

  console.log("\n✅ Verify + cleanup complete. Only superadmin and", PARTNER_EMAIL, "(+ their orgs) remain.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

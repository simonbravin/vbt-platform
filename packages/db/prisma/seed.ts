import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL =
  process.env.SUPERADMIN_EMAIL ?? "simon@visionbuildingtechs.com";
const SUPERADMIN_PASSWORD =
  process.env.SUPERADMIN_PASSWORD ?? "ChangeMe123!";

async function main() {
  console.log("🌱 Seeding Partner SaaS (Vision Latam)...");

  // ── 1. Default organization (Vision Latam) ────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: "seed-org-vision-latam" },
    update: {},
    create: {
      id: "seed-org-vision-latam",
      name: "Vision Latam",
      legalName: "Vision Latam SA",
      organizationType: "vision_latam",
      countryCode: "PA",
      status: "active",
    },
  });
  console.log("✅ Organization created:", org.name);

  // ── 2. Platform superadmin user ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { passwordHash, isActive: true, isPlatformSuperadmin: true },
    create: {
      fullName: "Platform Superadmin",
      email: SUPERADMIN_EMAIL,
      passwordHash,
      isActive: true,
      isPlatformSuperadmin: true,
    },
  });

  await prisma.orgMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: superAdmin.id,
      },
    },
    update: { role: "org_admin", status: "active" },
    create: {
      organizationId: org.id,
      userId: superAdmin.id,
      role: "org_admin",
      status: "active",
      joinedAt: new Date(),
    },
  });
  console.log("✅ Superadmin user:", superAdmin.email);

  console.log("\n🎉 Partner SaaS seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

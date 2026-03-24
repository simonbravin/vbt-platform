import type { Prisma, PrismaClient } from "@vbt/db";

const PARTNER_ORG_TYPES = ["commercial_partner", "master_partner"] as const;

/** Default-on when unset (matches partner form defaults). */
export async function resolveTrainingModuleVisible(
  prisma: PrismaClient,
  organizationId: string
): Promise<boolean> {
  const row = await prisma.platformConfig.findFirst({ select: { configJson: true } });
  const globalMv = (row?.configJson as { moduleVisibility?: Record<string, boolean> } | undefined)
    ?.moduleVisibility;
  const globalTraining = globalMv?.training !== false;

  const profile = await prisma.partnerProfile.findUnique({
    where: { organizationId },
    select: { moduleVisibility: true },
  });
  const override = profile?.moduleVisibility as Record<string, boolean> | null | undefined;
  if (override && typeof override.training === "boolean") {
    return override.training;
  }
  return globalTraining;
}

export async function assertPartnerOrgIds(
  prisma: PrismaClient,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const rows = await prisma.organization.findMany({
    where: { id: { in: ids }, organizationType: { in: [...PARTNER_ORG_TYPES] } },
    select: { id: true },
  });
  if (rows.length !== ids.length) {
    throw new Error("Invalid partner organization ids for training allowlist");
  }
}

/** Programs a partner user may see in the catalog. */
export function trainingProgramVisibleToPartnerWhere(organizationId: string): Prisma.TrainingProgramWhereInput {
  return {
    AND: [
      {
        OR: [{ publishedAt: { not: null } }, { status: "active", publishedAt: null }],
      },
      { status: { notIn: ["draft", "archived"] } },
      {
        OR: [
          { visibility: "all_partners" },
          {
            visibility: "selected_partners",
            allowedOrganizations: { some: { organizationId } },
          },
        ],
      },
    ],
  };
}

export function quizDefinitionVisibleToPartnerWhere(organizationId: string): Prisma.QuizDefinitionWhereInput {
  return {
    AND: [
      { status: "published" },
      { publishedAt: { not: null } },
      {
        OR: [
          { visibility: "all_partners" },
          {
            visibility: "selected_partners",
            allowedOrganizations: { some: { organizationId } },
          },
        ],
      },
    ],
  };
}

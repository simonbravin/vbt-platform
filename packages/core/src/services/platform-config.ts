import type { PrismaClient } from "@vbt/db";
import type { TenantContext } from "./tenant-context";

export type PlatformConfigJson = {
  pricing?: {
    defaultMarginMinPct?: number;
    defaultEntryFeeUsd?: number;
    defaultTrainingFeeUsd?: number;
    /** Vision Latam commission % applied to factory cost to obtain partner base price. Default 20. Partners never see factory cost. */
    visionLatamCommissionPct?: number;
  };
  moduleVisibility?: Record<string, boolean>;
  [key: string]: unknown;
};

const EMPTY_CONFIG: PlatformConfigJson = {
  pricing: {},
  moduleVisibility: {},
};

function requirePlatformAdmin(ctx: TenantContext) {
  if (!ctx.isPlatformSuperadmin) throw new Error("Platform superadmin required");
}

export async function getPlatformConfig(
  prisma: PrismaClient,
  ctx: TenantContext
): Promise<PlatformConfigJson> {
  requirePlatformAdmin(ctx);
  const row = await prisma.platformConfig.findFirst({
    select: { configJson: true },
  });
  if (!row?.configJson) return { ...EMPTY_CONFIG };
  const raw = row.configJson as Record<string, unknown>;
  return {
    pricing: (raw.pricing as PlatformConfigJson["pricing"]) ?? EMPTY_CONFIG.pricing,
    moduleVisibility: (raw.moduleVisibility as PlatformConfigJson["moduleVisibility"]) ?? EMPTY_CONFIG.moduleVisibility,
    ...raw,
  };
}

export type UpdatePlatformConfigInput = Partial<PlatformConfigJson>;

export async function updatePlatformConfig(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: UpdatePlatformConfigInput
): Promise<PlatformConfigJson> {
  requirePlatformAdmin(ctx);
  const current = await getPlatformConfig(prisma, ctx);
  const merged: PlatformConfigJson = {
    ...current,
    ...input,
    pricing: { ...current.pricing, ...input.pricing },
    moduleVisibility: input.moduleVisibility ?? current.moduleVisibility,
  };
  const existing = await prisma.platformConfig.findFirst({ select: { id: true } });
  if (existing) {
    await prisma.platformConfig.update({
      where: { id: existing.id },
      data: { configJson: merged as object },
    });
  } else {
    await prisma.platformConfig.create({
      data: { configJson: merged as object },
    });
  }
  return merged;
}

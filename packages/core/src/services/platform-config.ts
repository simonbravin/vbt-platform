import type { PrismaClient } from "@vbt/db";
import type { TenantContext } from "./tenant-context";

export type PlatformConfigJson = {
  pricing?: {
    /** Min margin % any partner can charge (base; overridable per partner). */
    defaultMarginMinPct?: number;
    /** Max margin % any partner can charge (base; overridable per partner). */
    defaultMarginMaxPct?: number;
    defaultEntryFeeUsd?: number;
    defaultTrainingFeeUsd?: number;
    /** Vision Latam commission % applied to factory cost to obtain partner base price. Default 20. Partners never see factory cost. */
    visionLatamCommissionPct?: number;
    /** Factory cost USD/m² by system. Only stored server-side; never sent to partner clients. */
    rateS80?: number;
    rateS150?: number;
    rateS200?: number;
    rateGlobal?: number;
    baseUom?: "M" | "FT";
    minRunFt?: number;
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

/**
 * Resolves Vision Latam commission % for a given organization (partner).
 * Uses PartnerProfile.visionLatamCommissionPct if set; otherwise platform_config default.
 * Used when creating a quote so the stored visionLatamMarkupPct is per-partner.
 */
export async function getVisionLatamCommissionPctForOrg(
  prisma: PrismaClient,
  organizationId: string
): Promise<number> {
  const profile = await prisma.partnerProfile.findUnique({
    where: { organizationId },
    select: { visionLatamCommissionPct: true },
  });
  if (profile?.visionLatamCommissionPct != null) {
    return profile.visionLatamCommissionPct;
  }
  const row = await prisma.platformConfig.findFirst({
    select: { configJson: true },
  });
  const raw = (row?.configJson as { pricing?: { visionLatamCommissionPct?: number } })?.pricing;
  return raw?.visionLatamCommissionPct ?? 20;
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

/** Default factory USD/m² by system. Used only server-side when platform_config has no values. */
const DEFAULT_RATE_S80 = 37;
const DEFAULT_RATE_S150 = 67;
const DEFAULT_RATE_S200 = 85;

/**
 * Get raw factory rates (USD/m²) from platform_config. Server-side only; never expose to client for partners.
 */
export async function getRawRatesFromConfig(prisma: PrismaClient): Promise<{
  rateS80: number;
  rateS150: number;
  rateS200: number;
  rateGlobal: number;
  baseUom: "M" | "FT";
  minRunFt: number;
}> {
  const row = await prisma.platformConfig.findFirst({ select: { configJson: true } });
  const p = (row?.configJson as { pricing?: Record<string, unknown> })?.pricing ?? {};
  return {
    rateS80: (p.rateS80 as number) ?? DEFAULT_RATE_S80,
    rateS150: (p.rateS150 as number) ?? DEFAULT_RATE_S150,
    rateS200: (p.rateS200 as number) ?? DEFAULT_RATE_S200,
    rateGlobal: (p.rateGlobal as number) ?? 0,
    baseUom: ((p.baseUom as string) === "FT" ? "FT" : "M") as "M" | "FT",
    minRunFt: (p.minRunFt as number) ?? 0,
  };
}

/**
 * Get quote defaults for an org: effective rates (factory × (1 + VL commission %)) so partners only see their base price per m².
 * Never returns raw factory rates to the client when used for partners.
 */
export async function getQuoteDefaultsForOrg(
  prisma: PrismaClient,
  organizationId: string
): Promise<{
  effectiveRateS80: number;
  effectiveRateS150: number;
  effectiveRateS200: number;
  baseUom: "M" | "FT";
  minRunFt: number;
}> {
  const raw = await getRawRatesFromConfig(prisma);
  const vlPct = await getVisionLatamCommissionPctForOrg(prisma, organizationId);
  const factor = 1 + vlPct / 100;
  return {
    effectiveRateS80: raw.rateS80 * factor,
    effectiveRateS150: raw.rateS150 * factor,
    effectiveRateS200: raw.rateS200 * factor,
    baseUom: raw.baseUom,
    minRunFt: raw.minRunFt,
  };
}

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
    /** Usable volume per shipping container (m³) for FCL count in the quote wizard. */
    containerCapacityM3?: number;
    /** Approx. wall m² per full container by system (FCL planning). Defaults used when unset. */
    containerWallAreaM2S80?: number;
    containerWallAreaM2S150?: number;
    containerWallAreaM2S200?: number;
  };
  moduleVisibility?: Record<string, boolean>;
  [key: string]: unknown;
};

const EMPTY_CONFIG: PlatformConfigJson = {
  pricing: {},
  moduleVisibility: {} as Record<string, boolean>,
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

/**
 * Platform-wide pricing knobs (server-side). No auth check — use only from trusted services.
 * Partner-specific resolution layers on top in `resolvePartnerPricingConfig`.
 */
export async function getPlatformPricingFallback(prisma: PrismaClient): Promise<{
  visionLatamCommissionPct: number;
  defaultMarginMinPct: number | null;
  defaultMarginMaxPct: number | null;
}> {
  const row = await prisma.platformConfig.findFirst({
    select: { configJson: true },
  });
  const p = (row?.configJson as PlatformConfigJson | undefined)?.pricing ?? {};
  return {
    visionLatamCommissionPct: p.visionLatamCommissionPct ?? 20,
    defaultMarginMinPct: p.defaultMarginMinPct ?? null,
    defaultMarginMaxPct: p.defaultMarginMaxPct ?? null,
  };
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

export type UpdatePlatformConfigInput = Partial<Omit<PlatformConfigJson, "pricing">> & {
  pricing?: {
    [K in keyof NonNullable<PlatformConfigJson["pricing"]>]?:
      | NonNullable<PlatformConfigJson["pricing"]>[K]
      | null;
  };
};

export async function updatePlatformConfig(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: UpdatePlatformConfigInput
): Promise<PlatformConfigJson> {
  requirePlatformAdmin(ctx);
  const current = await getPlatformConfig(prisma, ctx);
  const mergedPricing = { ...current.pricing };
  if (input.pricing) {
    for (const [key, value] of Object.entries(input.pricing)) {
      if (value === null) {
        delete mergedPricing[key as keyof NonNullable<PlatformConfigJson["pricing"]>];
      } else if (value !== undefined) {
        (mergedPricing as Record<string, unknown>)[key] = value;
      }
    }
  }
  const merged: PlatformConfigJson = {
    ...current,
    pricing: mergedPricing,
    moduleVisibility: (input.moduleVisibility ?? current.moduleVisibility ?? {}) as Record<string, boolean>,
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
export const DEFAULT_RATE_S80 = 37;
export const DEFAULT_RATE_S150 = 67;
export const DEFAULT_RATE_S200 = 85;
export const DEFAULT_VISION_LATAM_COMMISSION_PCT = 20;

/**
 * Get raw factory rates (USD/m²) from platform_config. Server-side only; never expose to client for partners.
 */
const DEFAULT_CONTAINER_CAPACITY_M3 = 68;
const DEFAULT_WALL_M2_S80 = 320;
const DEFAULT_WALL_M2_S150 = 420;
const DEFAULT_WALL_M2_S200 = 380;

function pickNonNegativeRate(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getRawRatesFromConfig(prisma: PrismaClient): Promise<{
  rateS80: number;
  rateS150: number;
  rateS200: number;
  rateGlobal: number;
  baseUom: "M" | "FT";
  minRunFt: number;
  containerCapacityM3: number;
  containerWallAreaM2S80: number;
  containerWallAreaM2S150: number;
  containerWallAreaM2S200: number;
}> {
  const row = await prisma.platformConfig.findFirst({ select: { configJson: true } });
  const p = (row?.configJson as { pricing?: Record<string, unknown> })?.pricing ?? {};
  const cap = Number(p.containerCapacityM3);
  const w80 = Number(p.containerWallAreaM2S80);
  const w150 = Number(p.containerWallAreaM2S150);
  const w200 = Number(p.containerWallAreaM2S200);
  return {
    rateS80: pickNonNegativeRate(p.rateS80, DEFAULT_RATE_S80),
    rateS150: pickNonNegativeRate(p.rateS150, DEFAULT_RATE_S150),
    rateS200: pickNonNegativeRate(p.rateS200, DEFAULT_RATE_S200),
    rateGlobal: (p.rateGlobal as number) ?? 0,
    baseUom: ((p.baseUom as string) === "FT" ? "FT" : "M") as "M" | "FT",
    minRunFt: (p.minRunFt as number) ?? 0,
    containerCapacityM3: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_CONTAINER_CAPACITY_M3,
    containerWallAreaM2S80: Number.isFinite(w80) && w80 > 0 ? w80 : DEFAULT_WALL_M2_S80,
    containerWallAreaM2S150: Number.isFinite(w150) && w150 > 0 ? w150 : DEFAULT_WALL_M2_S150,
    containerWallAreaM2S200: Number.isFinite(w200) && w200 > 0 ? w200 : DEFAULT_WALL_M2_S200,
  };
}

/**
 * Get quote defaults for an org: effective rates (factory × (1 + VL commission %)) so partners only see their base price per m².
 * Never returns raw factory rates to the client when used for partners.
 */
export type PricingFieldMeta = {
  /** Value in use for quotes (persisted or system default). */
  effective: number | null;
  /** Value stored in platform_config; null when using system default. */
  persisted: number | null;
  usesSystemDefault: boolean;
};

export type EffectivePlatformPricing = {
  defaultMarginMinPct: PricingFieldMeta;
  defaultMarginMaxPct: PricingFieldMeta;
  defaultEntryFeeUsd: PricingFieldMeta;
  defaultTrainingFeeUsd: PricingFieldMeta;
  visionLatamCommissionPct: PricingFieldMeta;
  rateS80: PricingFieldMeta;
  rateS150: PricingFieldMeta;
  rateS200: PricingFieldMeta;
};

function pricingFieldMeta(
  raw: Record<string, unknown>,
  key: string,
  systemDefault: number | null
): PricingFieldMeta {
  const persistedRaw = raw[key];
  const hasPersisted = typeof persistedRaw === "number" && Number.isFinite(persistedRaw);
  const persisted = hasPersisted ? persistedRaw : null;
  const effective = hasPersisted ? persistedRaw : systemDefault;
  return {
    effective,
    persisted,
    usesSystemDefault: !hasPersisted && systemDefault != null,
  };
}

function rateFieldMeta(
  raw: Record<string, unknown>,
  key: string,
  systemDefault: number,
  resolvedRate: number
): PricingFieldMeta {
  const meta = pricingFieldMeta(raw, key, systemDefault);
  return {
    ...meta,
    effective: meta.persisted != null ? meta.effective : resolvedRate,
  };
}

/** Resolved pricing for superadmin UI: effective values + persisted vs default flags. */
export async function getEffectivePlatformPricingForAdmin(
  prisma: PrismaClient
): Promise<EffectivePlatformPricing> {
  const row = await prisma.platformConfig.findFirst({ select: { configJson: true } });
  const p = (row?.configJson as { pricing?: Record<string, unknown> })?.pricing ?? {};
  const raw = await getRawRatesFromConfig(prisma);
  return {
    defaultMarginMinPct: pricingFieldMeta(p, "defaultMarginMinPct", null),
    defaultMarginMaxPct: pricingFieldMeta(p, "defaultMarginMaxPct", null),
    defaultEntryFeeUsd: pricingFieldMeta(p, "defaultEntryFeeUsd", null),
    defaultTrainingFeeUsd: pricingFieldMeta(p, "defaultTrainingFeeUsd", null),
    visionLatamCommissionPct: pricingFieldMeta(p, "visionLatamCommissionPct", DEFAULT_VISION_LATAM_COMMISSION_PCT),
    rateS80: rateFieldMeta(p, "rateS80", DEFAULT_RATE_S80, raw.rateS80),
    rateS150: rateFieldMeta(p, "rateS150", DEFAULT_RATE_S150, raw.rateS150),
    rateS200: rateFieldMeta(p, "rateS200", DEFAULT_RATE_S200, raw.rateS200),
  };
}

export async function getQuoteDefaultsForOrg(
  prisma: PrismaClient,
  organizationId: string
): Promise<{
  effectiveRateS80: number;
  effectiveRateS150: number;
  effectiveRateS200: number;
  baseUom: "M" | "FT";
  minRunFt: number;
  containerCapacityM3: number;
  containerWallAreaM2S80: number;
  containerWallAreaM2S150: number;
  containerWallAreaM2S200: number;
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
    containerCapacityM3: raw.containerCapacityM3,
    containerWallAreaM2S80: raw.containerWallAreaM2S80,
    containerWallAreaM2S150: raw.containerWallAreaM2S150,
    containerWallAreaM2S200: raw.containerWallAreaM2S200,
  };
}

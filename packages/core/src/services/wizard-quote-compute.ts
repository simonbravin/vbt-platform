/**
 * Shared wizard path: snapshot from CSV or m², FCL derivation, freight, taxes, SaaS canonical pricing.
 */

import type { PrismaClient } from "@vbt/db";
import { buildQuoteSnapshot, type PieceMeta, type QuoteInputLine } from "../quote-engine";
import { catalogPiecesToPieceMetaMap } from "../catalog-for-quote-wizard";
import { deriveFclContainersAndMetrics, deriveFclContainersFromWallM2 } from "../calculations";
import { canonicalizeSaaSQuotePayload } from "../pricing/saas-quote-persist";
import type { CreateQuoteItemInput } from "./quotes";
import { getRawRatesFromConfig } from "./platform-config";
import { resolveTaxRulesForSaaSQuote } from "./quote-tax-rules";
import {
  resolvePartnerPricingConfig,
  resolveSaaSQuotePricingForCreate,
} from "../pricing/partner-pricing-resolution";
import { buildQuotePricingReadModel } from "../pricing/quote-read-model";

export type WizardQuoteComputeInput = {
  projectId: string;
  costMethod: "CSV" | "M2_BY_SYSTEM";
  baseUom: "M" | "FT";
  revitImportId?: string | null;
  m2S80: number;
  m2S150: number;
  m2S200: number;
  m2Total: number;
  commissionPct: number;
  commissionFixed: number;
  commissionFixedPerKit: number;
  freightCostUsd: number;
  freightProfileId?: string | null;
  partnerMarkupPct?: number;
  destinationCountryCode?: string | null;
  totalKits: number;
};

export function wizardSnapshotLinesToItems(
  lines: Array<{
    description: string;
    pieceId?: string | null;
    qty: number;
    lineTotal: number;
    lineTotalWithMarkup: number;
    isIgnored: boolean;
  }>
): CreateQuoteItemInput[] {
  const out: CreateQuoteItemInput[] = [];
  let i = 0;
  for (const line of lines) {
    if (line.isIgnored) continue;
    const qty = Math.max(0, Number(line.qty) || 0);
    const lineGross = Math.max(0, Number(line.lineTotalWithMarkup ?? line.lineTotal) || 0);
    if (qty <= 0 || lineGross <= 0) continue;
    const unitCost = lineGross / qty;
    out.push({
      itemType: "product",
      sku: null,
      description: line.description,
      unit: "unit",
      quantity: qty,
      unitCost,
      markupPct: 0,
      unitPrice: unitCost,
      totalPrice: lineGross,
      sortOrder: i++,
      catalogPieceId: line.pieceId ?? null,
    });
  }
  return out;
}

function normalizeTaxCountryCode(
  projectCountryCode: string | null | undefined,
  destination?: string | null
): string {
  const d = destination?.trim().toUpperCase();
  if (d && d.length === 2) return d;
  const p = projectCountryCode?.trim().toUpperCase();
  if (p && p.length === 2) return p;
  return "";
}

export type WizardQuoteArtifacts = {
  snapshot: ReturnType<typeof buildQuoteSnapshot>;
  fcl: ReturnType<typeof deriveFclContainersAndMetrics> & {
    containerCapacityM3: number;
    totalVolumeM3: number;
    containerWallAreaM2S80: number;
    containerWallAreaM2S150: number;
    containerWallAreaM2S200: number;
  };
  freightTotalUsd: number;
  taxCountryCode: string;
  taxRules: Awaited<ReturnType<typeof resolveTaxRulesForSaaSQuote>>;
  items: CreateQuoteItemInput[];
  canon: ReturnType<typeof canonicalizeSaaSQuotePayload>;
  pricingReadModel: ReturnType<typeof buildQuotePricingReadModel>["pricing"];
};

export async function computeWizardQuoteArtifacts(
  prisma: PrismaClient,
  args: {
    organizationId: string;
    isPlatformSuperadmin: boolean;
    data: WizardQuoteComputeInput;
    project: { organizationId: string; countryCode: string | null };
    /** When false, pricing read model exposes factory EXW (wizard preview only). Default: mask for non-superadmin. */
    pricingMaskFactoryExw?: boolean;
  }
): Promise<WizardQuoteArtifacts> {
  const { organizationId, isPlatformSuperadmin, data, project } = args;
  const maskFactoryExw =
    args.pricingMaskFactoryExw !== undefined ? args.pricingMaskFactoryExw : !isPlatformSuperadmin;

  if (project.organizationId !== organizationId) {
    throw new Error("PROJECT_ORG_MISMATCH");
  }

  const taxCountryCode = normalizeTaxCountryCode(project.countryCode, data.destinationCountryCode);
  if (!taxCountryCode) {
    throw new Error("DESTINATION_COUNTRY_REQUIRED");
  }

  const taxRules = await resolveTaxRulesForSaaSQuote(prisma, {
    organizationId,
    projectCountryCode: taxCountryCode,
  });

  const resolved = await resolvePartnerPricingConfig(prisma, {
    organizationId,
    projectCountryCode: taxCountryCode,
  });

  const raw = await getRawRatesFromConfig(prisma);
  /** Partners: bake Vision Latam % into catalog / M² factory so list rates match quote-defaults; stack uses VL 0. Superadmin: raw catalog × rates + editable VL %. */
  const partnerFactoryCostMult = isPlatformSuperadmin ? 1 : 1 + resolved.effectiveVisionLatamMarkupPct / 100;

  const orgDefaults = {
    baseUom: data.baseUom,
    minRunFt: raw.minRunFt,
    rateS80: raw.rateS80 * partnerFactoryCostMult,
    rateS150: raw.rateS150 * partnerFactoryCostMult,
    rateS200: raw.rateS200 * partnerFactoryCostMult,
    rateGlobal: raw.rateGlobal * partnerFactoryCostMult,
  };

  let lines: QuoteInputLine[] | undefined;
  let pieceMeta: Record<string, PieceMeta> = {};

  if (data.costMethod === "CSV" && data.revitImportId) {
    const imp = await prisma.revitImport.findFirst({
      where: { id: data.revitImportId, organizationId },
      include: { lines: { orderBy: { rowNum: "asc" } } },
    });
    if (!imp) {
      throw new Error("IMPORT_NOT_FOUND");
    }
    const pieceIds = [
      ...new Set(imp.lines.map((l) => l.catalogPieceId).filter((x): x is string => Boolean(x))),
    ];
    const pieces = pieceIds.length
      ? await prisma.catalogPiece.findMany({
          where: { id: { in: pieceIds }, isActive: true },
          select: {
            id: true,
            canonicalName: true,
            dieNumber: true,
            systemCode: true,
            usefulWidthMm: true,
            lbsPerMCored: true,
            kgPerMCored: true,
            pricePerM2Cored: true,
          },
        })
      : [];
    pieceMeta = catalogPiecesToPieceMetaMap(pieces, { costMultiplier: partnerFactoryCostMult });
    // Wizard pricing policy: CSV costs follow configured system USD/m² rates.
    for (const meta of Object.values(pieceMeta)) {
      const ratePerM2 =
        meta.systemCode === "S80"
          ? orgDefaults.rateS80
          : meta.systemCode === "S150"
            ? orgDefaults.rateS150
            : meta.systemCode === "S200"
              ? orgDefaults.rateS200
              : 0;
      if (ratePerM2 > 0 && (meta.usefulWidthM ?? 0) > 0) {
        meta.cost = { pricePerMCored: ratePerM2 * (meta.usefulWidthM ?? 0) };
      }
    }
    lines = imp.lines
      .filter((l) => !l.isIgnored && l.catalogPieceId)
      .map((l) => ({
        description: l.rawPieceName,
        pieceId: l.catalogPieceId ?? undefined,
        qty: l.rawQty,
        heightMm: l.rawHeightMm,
        isIgnored: false,
      }));
  }

  const draftSnapshot = buildQuoteSnapshot({
    method: data.costMethod,
    baseUom: data.baseUom,
    lines,
    pieceMeta,
    m2S80: data.m2S80,
    m2S150: data.m2S150,
    m2S200: data.m2S200,
    m2Total: data.m2Total,
    orgDefaults,
    commissionPct: 0,
    commissionFixed: 0,
    commissionFixedPerKit: 0,
    freightCostUsd: 0,
    numContainers: 1,
    kitsPerContainer: 0,
    totalKits: data.totalKits,
    taxRules,
  });

  const volFcl = deriveFclContainersAndMetrics({
    totalKits: data.totalKits,
    totalVolumeM3: draftSnapshot.totalVolumeM3,
    containerCapacityM3: raw.containerCapacityM3,
  });
  const wallFcl = deriveFclContainersFromWallM2({
    m2S80: draftSnapshot.wallAreaM2S80,
    m2S150: draftSnapshot.wallAreaM2S150,
    m2S200: draftSnapshot.wallAreaM2S200,
    areaM2PerContainerS80: raw.containerWallAreaM2S80,
    areaM2PerContainerS150: raw.containerWallAreaM2S150,
    areaM2PerContainerS200: raw.containerWallAreaM2S200,
    totalKits: data.totalKits,
  });
  const kits = Math.max(0, Math.floor(Number(data.totalKits) || 0));
  const numContainersMerged = kits > 0 ? Math.max(wallFcl.numContainers, volFcl.numContainers, 1) : 1;
  const kitsPerContainerMerged =
    numContainersMerged > 0 && kits > 0 ? kits / numContainersMerged : 0;
  const totalSlots = wallFcl.totalSlots ?? 0;
  const fclBase = {
    numContainers: numContainersMerged,
    kitsPerContainer: kitsPerContainerMerged,
    slotsPerKit: wallFcl.slotsPerKit,
    totalSlots: wallFcl.totalSlots,
    occupancyPerKitPct: wallFcl.occupancyPerKitPct,
    occupancyTotalPct:
      numContainersMerged > 0 && totalSlots > 0
        ? (totalSlots / numContainersMerged) * 100
        : wallFcl.occupancyTotalPct,
    m2PerKitTotal: wallFcl.m2PerKitTotal,
  };

  let freightTotalUsd = Math.max(0, Number(data.freightCostUsd) || 0);
  if (data.freightProfileId?.trim()) {
    const profile = await prisma.freightProfile.findFirst({
      where: {
        id: data.freightProfileId.trim(),
        OR: [{ organizationId: null }, { organizationId }],
      },
      select: { freightPerContainer: true },
    });
    if (!profile) {
      throw new Error("FREIGHT_PROFILE_NOT_FOUND");
    }
    const per = Math.max(0, Number(profile.freightPerContainer) || 0);
    freightTotalUsd = per * fclBase.numContainers;
  }

  const snapshot = buildQuoteSnapshot({
    method: data.costMethod,
    baseUom: data.baseUom,
    lines,
    pieceMeta,
    m2S80: data.m2S80,
    m2S150: data.m2S150,
    m2S200: data.m2S200,
    m2Total: data.m2Total,
    orgDefaults,
    commissionPct: 0,
    commissionFixed: 0,
    commissionFixedPerKit: 0,
    freightCostUsd: freightTotalUsd,
    numContainers: fclBase.numContainers,
    kitsPerContainer: fclBase.kitsPerContainer,
    totalKits: data.totalKits,
    taxRules,
  });

  const itemsPerKit = data.costMethod === "CSV" ? wizardSnapshotLinesToItems(snapshot.lines) : [];

  if (data.costMethod === "CSV" && itemsPerKit.length === 0) {
    throw new Error("WIZARD_CSV_NO_LINES");
  }

  const totalKitsSafe = Math.max(0, Math.floor(Number(data.totalKits) || 0));
  /** Wall/CSV costs in snapshot are per kit; pricing and persist use full order totals. */
  const kitMultiplier = totalKitsSafe > 0 ? totalKitsSafe : 1;
  const orderItems = itemsPerKit.map((it) => ({
    ...it,
    quantity: Math.max(0, Number(it.quantity) || 0) * kitMultiplier,
  }));
  const items = orderItems;

  const technicalServiceCost =
    (Number(data.commissionFixed) || 0) + (Number(data.commissionFixedPerKit) || 0) * totalKitsSafe;

  const pricingInputs = resolveSaaSQuotePricingForCreate({
    isSuperadmin: isPlatformSuperadmin,
    explicit: {
      visionLatamMarkupPct:
        isPlatformSuperadmin && data.commissionPct > 0 ? data.commissionPct : undefined,
      logisticsCost: freightTotalUsd,
      importCost: undefined,
      localTransportCost: undefined,
      technicalServiceCost,
      ...(data.partnerMarkupPct !== undefined && data.partnerMarkupPct !== null
        ? { partnerMarkupPct: data.partnerMarkupPct }
        : {}),
    },
    resolved,
  });

  const hasLines = items.length > 0;
  const visionLatamMarkupPctForCanon = isPlatformSuperadmin ? pricingInputs.visionLatamMarkupPct : 0;

  const canon = canonicalizeSaaSQuotePayload({
    items: hasLines ? orderItems : [],
    headerFactoryExwUsd: hasLines ? undefined : snapshot.factoryCostUsd * kitMultiplier,
    visionLatamMarkupPct: visionLatamMarkupPctForCanon,
    partnerMarkupPct: pricingInputs.partnerMarkupPct,
    logisticsCostUsd: pricingInputs.logisticsCostUsd,
    localTransportCostUsd: pricingInputs.localTransportCostUsd,
    importCostUsd: pricingInputs.importCostUsd,
    technicalServiceUsd: pricingInputs.technicalServiceUsd,
    taxRules,
    numContainers: fclBase.numContainers,
  });

  const syntheticQuote: Record<string, unknown> = {
    factoryCostTotal: canon.factoryCostTotal,
    visionLatamMarkupPct: canon.visionLatamMarkupPct,
    partnerMarkupPct: canon.partnerMarkupPct,
    logisticsCost: canon.logisticsCostUsd,
    localTransportCost: canon.localTransportCostUsd,
    importCost: canon.importCostUsd,
    technicalServiceCost: canon.technicalServiceUsd,
    totalPrice: canon.totalPrice,
    taxRulesSnapshotJson: taxRules,
    numContainers: fclBase.numContainers,
  };

  const { pricing: pricingReadModel } = buildQuotePricingReadModel(syntheticQuote, {
    taxRules,
    maskFactoryExw,
  });

  return {
    snapshot,
    fcl: {
      ...fclBase,
      containerCapacityM3: raw.containerCapacityM3,
      totalVolumeM3: snapshot.totalVolumeM3,
      containerWallAreaM2S80: raw.containerWallAreaM2S80,
      containerWallAreaM2S150: raw.containerWallAreaM2S150,
      containerWallAreaM2S200: raw.containerWallAreaM2S200,
    },
    freightTotalUsd,
    taxCountryCode,
    taxRules,
    items,
    canon,
    pricingReadModel,
  };
}

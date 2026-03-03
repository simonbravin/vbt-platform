/**
 * Quote Engine – assembles all computations into a quote snapshot.
 */

import {
  computeLineMetrics,
  computeLinePrice,
  checkMinRun,
  computeFactoryCostBySystem,
  computeFactoryCostTotal,
  computeFob,
  computeCif,
  computeTaxLines,
  sumTaxLines,
  computeConcreteAndSteel,
  TaxRule,
  TaxLineResult,
} from "./calculations";

export type CostMethod = "CSV" | "M2_BY_SYSTEM" | "M2_TOTAL";
export type BaseUom = "M" | "FT";

export interface PieceMeta {
  id: string;
  systemCode?: "S80" | "S150" | "S200" | null;
  usefulWidthM?: number;
  lbsPerMCored?: number;
  lbsPerMUncored?: number;
  volumePerM?: number;
  cost?: {
    pricePer5000ftCored?: number;
    pricePerFtCored?: number;
    pricePerMCored?: number;
  };
  minRunFtOverride?: number;
}

export interface QuoteInputLine {
  description: string;
  pieceId?: string;
  qty: number;
  heightMm: number;
  markupPct?: number;
  manualPricePerM?: number; // override
  isIgnored?: boolean;
}

export interface OrgDefaults {
  baseUom: BaseUom;
  minRunFt: number;
  rateS80: number;
  rateS150: number;
  rateS200: number;
  rateGlobal: number;
  steelKgPerM2S80?: number;
  steelKgPerM2S150?: number;
  steelKgPerM2S200?: number;
  concreteM3PerM2S80?: number;
  concreteM3PerM2S150?: number;
  concreteM3PerM2S200?: number;
}

export interface QuoteInput {
  method: CostMethod;
  baseUom: BaseUom;
  lines?: QuoteInputLine[];
  pieceMeta?: Record<string, PieceMeta>;
  // M2 by system (overrides or direct entry)
  m2S80?: number;
  m2S150?: number;
  m2S200?: number;
  m2Total?: number;
  orgDefaults: OrgDefaults;
  // Commission
  commissionPct?: number;
  commissionFixed?: number;
  // Freight
  freightCostUsd?: number;
  numContainers?: number;
  kitsPerContainer?: number;
  totalKits?: number;
  // Taxes
  taxRules?: TaxRule[];
}

export interface QuoteOutputLine {
  description: string;
  pieceId?: string;
  systemCode?: "S80" | "S150" | "S200" | null;
  qty: number;
  heightMm: number;
  linearM: number;
  linearFt: number;
  m2Line: number;
  weightKgCored: number;
  weightKgUncored: number;
  volumeM3: number;
  unitPrice: number;
  markupPct: number;
  lineTotal: number;
  lineTotalWithMarkup: number;
  isBelowMinRun: boolean;
  productionNeeded: number;
  isIgnored: boolean;
}

export interface QuoteSnapshot {
  method: CostMethod;
  baseUom: BaseUom;
  lines: QuoteOutputLine[];
  // Aggregates
  wallAreaM2S80: number;
  wallAreaM2S150: number;
  wallAreaM2S200: number;
  wallAreaM2Total: number;
  totalWeightKgCored: number;
  totalWeightKgUncored: number;
  totalVolumeM3: number;
  // Costs
  factoryCostUsd: number;
  commissionPct: number;
  commissionFixed: number;
  commissionAmount: number;
  fobUsd: number;
  freightCostUsd: number;
  numContainers: number;
  kitsPerContainer: number;
  totalKits: number;
  cifUsd: number;
  taxLines: TaxLineResult[];
  taxesFeesUsd: number;
  landedDdpUsd: number;
  // Informational
  concreteM3: number;
  steelKgEst: number;
}

export function buildQuoteSnapshot(input: QuoteInput): QuoteSnapshot {
  const { orgDefaults, baseUom } = input;
  const minRunFt = orgDefaults.minRunFt;

  const outputLines: QuoteOutputLine[] = [];
  let wallAreaM2S80 = input.m2S80 ?? 0;
  let wallAreaM2S150 = input.m2S150 ?? 0;
  let wallAreaM2S200 = input.m2S200 ?? 0;
  let totalWeightKgCored = 0;
  let totalWeightKgUncored = 0;
  let totalVolumeM3 = 0;
  let csvTotalCost = 0;

  // ── Process CSV lines ─────────────────────────────────────────────────────
  if (input.method === "CSV" && input.lines) {
    for (const line of input.lines) {
      if (line.isIgnored) {
        outputLines.push({
          description: line.description,
          pieceId: line.pieceId,
          systemCode: null,
          qty: line.qty,
          heightMm: line.heightMm,
          linearM: 0,
          linearFt: 0,
          m2Line: 0,
          weightKgCored: 0,
          weightKgUncored: 0,
          volumeM3: 0,
          unitPrice: 0,
          markupPct: 0,
          lineTotal: 0,
          lineTotalWithMarkup: 0,
          isBelowMinRun: false,
          productionNeeded: 0,
          isIgnored: true,
        });
        continue;
      }

      const meta = line.pieceId ? input.pieceMeta?.[line.pieceId] : undefined;

      const metrics = computeLineMetrics({
        qty: line.qty,
        heightMm: line.heightMm,
        usefulWidthM: meta?.usefulWidthM ?? 0,
        lbsPerMCored: meta?.lbsPerMCored ?? 0,
        lbsPerMUncored: meta?.lbsPerMUncored ?? 0,
        volumePerM: meta?.volumePerM ?? 0,
      });

      // Accumulate wall area by system
      const sc = meta?.systemCode;
      if (sc === "S80") wallAreaM2S80 += metrics.m2Line;
      else if (sc === "S150") wallAreaM2S150 += metrics.m2Line;
      else if (sc === "S200") wallAreaM2S200 += metrics.m2Line;

      totalWeightKgCored += metrics.weightKgCored;
      totalWeightKgUncored += metrics.weightKgUncored;
      totalVolumeM3 += metrics.volumeM3;

      // Price
      const pieceRunFt = meta?.minRunFtOverride ?? minRunFt;
      const { isBelowMinRun, productionNeeded } = checkMinRun(metrics.linearFt, pieceRunFt);
      const markupPct = line.markupPct ?? 0;

      let unitPrice = 0;
      let lineTotal = 0;
      let lineTotalWithMarkup = 0;

      if (line.manualPricePerM) {
        // Manual override
        unitPrice = line.manualPricePerM;
        lineTotal = metrics.linearM * unitPrice;
        lineTotalWithMarkup = lineTotal * (1 + markupPct / 100);
      } else if (meta?.cost) {
        const priceResult = computeLinePrice(
          metrics.linearM,
          metrics.linearFt,
          meta.cost,
          baseUom,
          markupPct
        );
        unitPrice = priceResult.unitPrice;
        lineTotal = priceResult.lineTotal;
        lineTotalWithMarkup = priceResult.lineTotalWithMarkup;
      }

      csvTotalCost += lineTotalWithMarkup;

      outputLines.push({
        description: line.description,
        pieceId: line.pieceId,
        systemCode: sc ?? null,
        qty: line.qty,
        heightMm: line.heightMm,
        ...metrics,
        unitPrice,
        markupPct,
        lineTotal,
        lineTotalWithMarkup,
        isBelowMinRun,
        productionNeeded,
        isIgnored: false,
      });
    }
  }

  const wallAreaM2Total = wallAreaM2S80 + wallAreaM2S150 + wallAreaM2S200 + (input.m2Total ?? 0);

  // ── Factory Cost ──────────────────────────────────────────────────────────
  let factoryCostUsd = 0;

  switch (input.method) {
    case "CSV":
      factoryCostUsd = csvTotalCost;
      break;
    case "M2_BY_SYSTEM":
      factoryCostUsd = computeFactoryCostBySystem({
        m2S80: wallAreaM2S80,
        m2S150: wallAreaM2S150,
        m2S200: wallAreaM2S200,
        rateS80: orgDefaults.rateS80,
        rateS150: orgDefaults.rateS150,
        rateS200: orgDefaults.rateS200,
      });
      break;
    case "M2_TOTAL":
      factoryCostUsd = computeFactoryCostTotal(
        input.m2Total ?? wallAreaM2Total,
        orgDefaults.rateGlobal
      );
      break;
  }

  // ── Commission & FOB ──────────────────────────────────────────────────────
  const commissionPct = input.commissionPct ?? 0;
  const commissionFixed = input.commissionFixed ?? 0;
  const { commissionAmount, fobUsd } = computeFob({
    factoryCost: factoryCostUsd,
    commissionPct,
    commissionFixed,
  });

  // ── CIF ───────────────────────────────────────────────────────────────────
  const freightCostUsd = input.freightCostUsd ?? 0;
  const numContainers = input.numContainers ?? 1;
  const kitsPerContainer = input.kitsPerContainer ?? 0;
  const totalKits = input.totalKits ?? 0;
  const cifUsd = computeCif(fobUsd, freightCostUsd);

  // ── Taxes ─────────────────────────────────────────────────────────────────
  const taxRules = input.taxRules ?? [];
  const taxLines = computeTaxLines({ cifUsd, fobUsd, numContainers, rules: taxRules });
  const taxesFeesUsd = sumTaxLines(taxLines);
  const landedDdpUsd = cifUsd + taxesFeesUsd;

  // ── Informational ─────────────────────────────────────────────────────────
  const { concreteM3, steelKgEst } = computeConcreteAndSteel({
    m2S80: wallAreaM2S80,
    m2S150: wallAreaM2S150,
    m2S200: wallAreaM2S200,
    concreteM3PerM2S80: orgDefaults.concreteM3PerM2S80,
    concreteM3PerM2S150: orgDefaults.concreteM3PerM2S150,
    concreteM3PerM2S200: orgDefaults.concreteM3PerM2S200,
    steelKgPerM2S80: orgDefaults.steelKgPerM2S80,
    steelKgPerM2S150: orgDefaults.steelKgPerM2S150,
    steelKgPerM2S200: orgDefaults.steelKgPerM2S200,
  });

  return {
    method: input.method,
    baseUom,
    lines: outputLines,
    wallAreaM2S80,
    wallAreaM2S150,
    wallAreaM2S200,
    wallAreaM2Total,
    totalWeightKgCored,
    totalWeightKgUncored,
    totalVolumeM3,
    factoryCostUsd,
    commissionPct,
    commissionFixed,
    commissionAmount,
    fobUsd,
    freightCostUsd,
    numContainers,
    kitsPerContainer,
    totalKits,
    cifUsd,
    taxLines,
    taxesFeesUsd,
    landedDdpUsd,
    concreteM3,
    steelKgEst,
  };
}

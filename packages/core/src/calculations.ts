/**
 * VBT Core Calculation Library
 * All calculations for CSV import, quoting, freight, and taxes.
 */

export const M_TO_FT = 3.28084;
export const FT_TO_M = 0.3048;
export const LBS_TO_KG = 0.45359237;

// ─── Line Metrics ─────────────────────────────────────────────────────────────

export interface LineMetricsInput {
  qty: number;
  heightMm: number;
  usefulWidthM?: number;
  lbsPerMCored?: number;
  lbsPerMUncored?: number;
  volumePerM?: number;
}

export interface LineMetrics {
  linearM: number;
  linearFt: number;
  m2Line: number;
  weightLbsCored: number;
  weightLbsUncored: number;
  weightKgCored: number;
  weightKgUncored: number;
  volumeM3: number;
}

export function computeLineMetrics(input: LineMetricsInput): LineMetrics {
  const { qty, heightMm, usefulWidthM = 0, lbsPerMCored = 0, lbsPerMUncored = 0, volumePerM = 0 } = input;

  const linearM = qty * (heightMm / 1000);
  const linearFt = linearM * M_TO_FT;
  const m2Line = linearM * usefulWidthM;
  const weightLbsCored = linearM * lbsPerMCored;
  const weightLbsUncored = linearM * lbsPerMUncored;
  const weightKgCored = weightLbsCored * LBS_TO_KG;
  const weightKgUncored = weightLbsUncored * LBS_TO_KG;
  const volumeM3 = linearM * volumePerM;

  return {
    linearM,
    linearFt,
    m2Line,
    weightLbsCored,
    weightLbsUncored,
    weightKgCored,
    weightKgUncored,
    volumeM3,
  };
}

// ─── Price per UOM ────────────────────────────────────────────────────────────

export interface PiecePrice {
  pricePer5000ftCored?: number;
  pricePerFtCored?: number;
  pricePerMCored?: number;
}

export function derivePrices(cost: PiecePrice): {
  pricePerFt: number;
  pricePerM: number;
} {
  let pricePerFt = cost.pricePerFtCored ?? 0;
  let pricePerM = cost.pricePerMCored ?? 0;

  if (!pricePerFt && !pricePerM && cost.pricePer5000ftCored) {
    pricePerFt = cost.pricePer5000ftCored / 5000;
    pricePerM = pricePerFt / FT_TO_M;
  } else if (pricePerFt && !pricePerM) {
    pricePerM = pricePerFt / FT_TO_M;
  } else if (pricePerM && !pricePerFt) {
    pricePerFt = pricePerM * FT_TO_M;
  }

  return { pricePerFt, pricePerM };
}

export function computeLinePrice(
  linearM: number,
  linearFt: number,
  cost: PiecePrice,
  baseUom: "M" | "FT",
  markupPct: number = 0
): { unitPrice: number; lineTotal: number; lineTotalWithMarkup: number } {
  const { pricePerFt, pricePerM } = derivePrices(cost);

  let unitPrice = 0;
  let lineTotal = 0;

  if (baseUom === "M") {
    unitPrice = pricePerM;
    lineTotal = linearM * pricePerM;
  } else {
    unitPrice = pricePerFt;
    lineTotal = linearFt * pricePerFt;
  }

  const lineTotalWithMarkup = lineTotal * (1 + markupPct / 100);
  return { unitPrice, lineTotal, lineTotalWithMarkup };
}

// ─── Min Run Check ────────────────────────────────────────────────────────────

export function checkMinRun(
  linearFt: number,
  minRunFt: number = 5000
): { isBelowMinRun: boolean; productionNeeded: number } {
  const isBelowMinRun = linearFt < minRunFt;
  const productionNeeded = isBelowMinRun ? minRunFt - linearFt : 0;
  return { isBelowMinRun, productionNeeded };
}

// ─── M2 by System ─────────────────────────────────────────────────────────────

export interface M2SystemInput {
  m2S80: number;
  m2S150: number;
  m2S200: number;
  rateS80: number;
  rateS150: number;
  rateS200: number;
}

export function computeFactoryCostBySystem(input: M2SystemInput): number {
  return (
    input.m2S80 * input.rateS80 +
    input.m2S150 * input.rateS150 +
    input.m2S200 * input.rateS200
  );
}

// ─── M2 Total (Quick) ─────────────────────────────────────────────────────────

export function computeFactoryCostTotal(m2Total: number, globalRate: number): number {
  return m2Total * globalRate;
}

// ─── Commission & FOB ────────────────────────────────────────────────────────

export interface CommissionInput {
  factoryCost: number;
  commissionPct: number;
  commissionFixed: number;
}

export function computeFob(input: CommissionInput): {
  commissionAmount: number;
  fobUsd: number;
} {
  const commissionAmount =
    input.factoryCost * (input.commissionPct / 100) + input.commissionFixed;
  const fobUsd = input.factoryCost + commissionAmount;
  return { commissionAmount, fobUsd };
}

// ─── CIF ─────────────────────────────────────────────────────────────────────

export function computeCif(fobUsd: number, freightCost: number): number {
  return fobUsd + freightCost;
}

// ─── Tax Engine ──────────────────────────────────────────────────────────────

export type TaxBase =
  | "CIF"
  | "FOB"
  | "BASE_IMPONIBLE"
  | "FIXED_PER_CONTAINER"
  | "FIXED_TOTAL";

export interface TaxRule {
  order: number;
  label: string;
  base: TaxBase;
  ratePct?: number;
  fixedAmount?: number;
  perContainer?: boolean;
  note?: string;
}

export interface TaxLineResult {
  order: number;
  label: string;
  base: TaxBase;
  ratePct?: number;
  fixedAmount?: number;
  baseAmount: number;
  computedAmount: number;
  perContainer: boolean;
}

export interface TaxEngineInput {
  cifUsd: number;
  fobUsd: number;
  numContainers: number;
  rules: TaxRule[];
}

export function computeTaxLines(input: TaxEngineInput): TaxLineResult[] {
  const { cifUsd, fobUsd, numContainers, rules } = input;
  const sorted = [...rules].sort((a, b) => a.order - b.order);

  // Track accumulated amounts for BASE_IMPONIBLE
  let dutyTotal = 0;
  let statisticTotal = 0;

  const results: TaxLineResult[] = [];

  for (const rule of sorted) {
    let baseAmount = 0;
    let computedAmount = 0;
    const perContainer = rule.perContainer ?? false;

    switch (rule.base) {
      case "CIF":
        baseAmount = cifUsd;
        computedAmount = cifUsd * ((rule.ratePct ?? 0) / 100);
        // Track for base_imponible calculation
        if (rule.label.toLowerCase().includes("duty")) dutyTotal = computedAmount;
        if (rule.label.toLowerCase().includes("statistic")) statisticTotal = computedAmount;
        break;

      case "FOB":
        baseAmount = fobUsd;
        computedAmount = fobUsd * ((rule.ratePct ?? 0) / 100);
        break;

      case "BASE_IMPONIBLE": {
        // BASE_IMPONIBLE = CIF + duty + statistic (from previous lines)
        const baseImponible = cifUsd + dutyTotal + statisticTotal;
        baseAmount = baseImponible;
        computedAmount = baseImponible * ((rule.ratePct ?? 0) / 100);
        break;
      }

      case "FIXED_PER_CONTAINER":
        baseAmount = numContainers;
        computedAmount = (rule.fixedAmount ?? 0) * numContainers;
        break;

      case "FIXED_TOTAL":
        baseAmount = 1;
        computedAmount = rule.fixedAmount ?? 0;
        break;
    }

    results.push({
      order: rule.order,
      label: rule.label,
      base: rule.base,
      ratePct: rule.ratePct,
      fixedAmount: rule.fixedAmount,
      baseAmount,
      computedAmount,
      perContainer,
    });
  }

  return results;
}

export function sumTaxLines(lines: TaxLineResult[]): number {
  return lines.reduce((acc, l) => acc + l.computedAmount, 0);
}

// ─── Informational Outputs ────────────────────────────────────────────────────

export interface ConcreteAndSteelInput {
  m2S80: number;
  m2S150: number;
  m2S200: number;
  concreteM3PerM2S80?: number;
  concreteM3PerM2S150?: number;
  concreteM3PerM2S200?: number;
  steelKgPerM2S80?: number;
  steelKgPerM2S150?: number;
  steelKgPerM2S200?: number;
}

export function computeConcreteAndSteel(input: ConcreteAndSteelInput): {
  concreteM3: number;
  steelKgEst: number;
} {
  const {
    m2S80,
    m2S150,
    m2S200,
    concreteM3PerM2S80 = 0.08,
    concreteM3PerM2S150 = 0.15,
    concreteM3PerM2S200 = 0.2,
    steelKgPerM2S80 = 4,
    steelKgPerM2S150 = 6,
    steelKgPerM2S200 = 8,
  } = input;

  const concreteM3 =
    m2S80 * concreteM3PerM2S80 +
    m2S150 * concreteM3PerM2S150 +
    m2S200 * concreteM3PerM2S200;

  const steelKgEst =
    m2S80 * steelKgPerM2S80 +
    m2S150 * steelKgPerM2S150 +
    m2S200 * steelKgPerM2S200;

  return { concreteM3, steelKgEst };
}

// ─── Container Calculation ────────────────────────────────────────────────────

export function computeContainers(
  totalKits: number,
  kitsPerContainer: number
): number {
  if (kitsPerContainer <= 0) return 0;
  return Math.ceil(totalKits / kitsPerContainer);
}

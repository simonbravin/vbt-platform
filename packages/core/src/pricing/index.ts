/**
 * Pricing — domain boundaries
 *
 * - **`calculations.ts`** (re-exported): low-level math primitives (line price, FOB additive, CIF, tax lines).
 * - **`priceQuote`**: orchestration for **CSV / geometry** quotes (wizard); additive commission on factory subtotal.
 * - **`priceSaaSQuoteLayers`**: primitives composed for **SaaS header** stack (multiplicative VL + partner).
 * - **`canonicalizeSaaSQuotePayload`**: **authoritative** SaaS persist shape (factory + landed from layers only).
 * - **Read model** (`formatQuoteForSaaSApi`, `formatQuoteForSaaSApiWithSnapshot`, `toLegacySalesQuoteShape`): single financial interpretation for APIs (snapshot obligatorio en handlers HTTP).
 */

import type { CommissionInput, PiecePrice, TaxEngineInput, TaxLineResult, TaxRule } from "../calculations";
import {
  computeCif,
  computeFob,
  computeLineMetrics,
  computeLinePrice,
  computeTaxLines,
  derivePrices,
  sumTaxLines,
} from "../calculations";
/** Wizard / line-based context (additive commission on factory subtotal). */
export type PricingContext = {
  baseUom: "M" | "FT";
  commissionPct: number;
  commissionFixed: number;
  freightCostUsd: number;
  numContainers: number;
  taxRules: TaxRule[];
};

export type QuotePricingContextMeta = {
  organizationId?: string | null;
  countryCode?: string | null;
  freightProfileId?: string | null;
  taxRules?: TaxRule[];
};

/**
 * @deprecated Prefer `ResolvedPartnerPricingConfig` from `resolvePartnerPricingConfig` for SaaS quotes.
 * Kept for older docs / call sites that only need a shallow policy hint.
 */
export type PartnerPricingConfig = {
  defaultVisionLatamMarkupPct?: number;
  defaultPartnerMarkupPct?: number;
  allowedPartnerMarkupMinPct?: number;
  allowedPartnerMarkupMaxPct?: number;
  countryOverrides?: Partial<Record<string, { visionLatamMarkupPct?: number; partnerMarkupPct?: number }>>;
};

export type PriceQuoteLineInput = {
  qty: number;
  heightMm: number;
  usefulWidthM?: number;
  lbsPerMCored?: number;
  lbsPerMUncored?: number;
  volumePerM?: number;
  pieceCost: PiecePrice;
  markupPct?: number;
};

export type PriceQuoteInput = {
  lines: PriceQuoteLineInput[];
  context: PricingContext;
};

export type PriceQuoteLineResult = {
  linearM: number;
  linearFt: number;
  m2Line: number;
  unitPrice: number;
  lineTotal: number;
  lineTotalWithMarkup: number;
};

export type PriceQuoteResult = {
  lines: PriceQuoteLineResult[];
  factoryCostTotal: number;
  fob: ReturnType<typeof computeFob>;
  cifUsd: number;
  taxLines: TaxLineResult[];
  taxesFeesUsd: number;
};

export function priceQuote(input: PriceQuoteInput): PriceQuoteResult {
  const { lines, context } = input;
  const { baseUom, commissionPct, commissionFixed, freightCostUsd, numContainers, taxRules } = context;

  const pricedLines: PriceQuoteLineResult[] = [];
  let factoryCostTotal = 0;

  for (const line of lines) {
    const metrics = computeLineMetrics({
      qty: line.qty,
      heightMm: line.heightMm,
      usefulWidthM: line.usefulWidthM,
      lbsPerMCored: line.lbsPerMCored,
      lbsPerMUncored: line.lbsPerMUncored,
      volumePerM: line.volumePerM,
    });
    const priced = computeLinePrice(
      metrics.linearM,
      metrics.linearFt,
      line.pieceCost,
      baseUom,
      line.markupPct ?? 0
    );
    factoryCostTotal += priced.lineTotalWithMarkup;
    pricedLines.push({
      linearM: metrics.linearM,
      linearFt: metrics.linearFt,
      m2Line: metrics.m2Line,
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal,
      lineTotalWithMarkup: priced.lineTotalWithMarkup,
    });
  }

  const fob = computeFob({
    factoryCost: factoryCostTotal,
    commissionPct,
    commissionFixed,
  } satisfies CommissionInput);
  const cifUsd = computeCif(fob.fobUsd, freightCostUsd);
  const taxLines = computeTaxLines({
    cifUsd,
    fobUsd: fob.fobUsd,
    numContainers,
    rules: taxRules,
  } satisfies TaxEngineInput);
  const taxesFeesUsd = sumTaxLines(taxLines);

  return {
    lines: pricedLines,
    factoryCostTotal,
    fob,
    cifUsd,
    taxLines,
    taxesFeesUsd,
  };
}

export type { SaaSQuotePricingInput, SaaSQuotePricingResult } from "./saas-layers";
export { priceSaaSQuoteLayers } from "./saas-layers";

export {
  canonicalizeSaaSQuotePayload,
  mergeSaaSQuotePatchIntoSource,
  normalizeSaaSQuoteItemLine,
  patchRequiresSaaSQuotePricingRecompute,
  prismaQuoteItemsToInputs,
  type CanonicalSaaSQuotePersist,
  type CanonicalSaaSQuoteSource,
  type MergedSaaSQuotePatchSource,
} from "./saas-quote-persist";

export {
  buildQuotePricingReadModel,
  formatQuoteForSaaSApi,
  formatQuoteForSaaSApiWithSnapshot,
  formatQuoteForSaaSApiListRow,
  quoteRowFobUsd,
  toLegacySalesQuoteShape,
  type QuotePricingReadModel,
} from "./quote-read-model";

export {
  clampPartnerMarkupOnMergedSaaSSource,
  clampPartnerMarkupPct,
  parsePartnerQuoteDefaultsJson,
  resolvePartnerPricingConfig,
  resolveSaaSQuotePricingForCreate,
  type CountryQuotePricingOverride,
  type ExplicitSaaSQuotePricingFields,
  type PartnerQuoteDefaultsJson,
  type ResolvedPartnerPricingConfig,
} from "./partner-pricing-resolution";

export { derivePrices, computeLineMetrics, computeLinePrice, computeFob, computeCif, computeTaxLines, sumTaxLines };

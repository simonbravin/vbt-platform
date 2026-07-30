/**
 * Consistent quote pricing read model for API responses (SaaS + legacy enrich).
 */

import type { TaxRule } from "../calculations";
import {
  parseTaxRulesSnapshotFromQuoteRow,
  requireTaxRulesSnapshotFromQuote,
} from "../services/quote-tax-rules";
import { priceSaaSQuoteLayers, type SaaSQuotePricingResult } from "./saas-layers";

export type QuotePricingReadModel = Omit<SaaSQuotePricingResult, "factoryExwUsd" | "afterVisionLatamUsd"> & {
  factoryExwUsd: number | null;
  afterVisionLatamUsd: number | null;
  /** Persisted landed total (must equal `suggestedLandedUsd` for SaaS writes). */
  landedTotalUsd: number;
};

function quoteNumContainers(quote: Record<string, unknown>): number {
  const n = Number(quote.numContainers ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function quoteRecordToLayerInput(quote: Record<string, unknown>, taxRules?: TaxRule[]) {
  return {
    factoryExwUsd: Number(quote.factoryCostTotal ?? 0),
    visionLatamMarkupPct: Number(quote.visionLatamMarkupPct ?? 0),
    partnerMarkupPct: Number(quote.partnerMarkupPct ?? 0),
    logisticsCostUsd: Number(quote.logisticsCost ?? 0),
    localTransportCostUsd: Number(quote.localTransportCost ?? 0),
    importCostUsd: Number(quote.importCost ?? 0),
    technicalServiceUsd: Number(quote.technicalServiceCost ?? 0),
    taxRules,
    numContainers: quoteNumContainers(quote),
  };
}

function effectiveTaxRulesForReadModel(
  quote: Record<string, unknown>,
  explicit?: TaxRule[]
): TaxRule[] {
  if (explicit !== undefined) return explicit;
  return requireTaxRulesSnapshotFromQuote({
    id: typeof quote.id === "string" ? quote.id : undefined,
    taxRulesSnapshotJson: quote.taxRulesSnapshotJson,
  });
}

export function buildQuotePricingReadModel(
  quote: Record<string, unknown>,
  opts?: { taxRules?: TaxRule[]; maskFactoryExw?: boolean }
): { pricing: QuotePricingReadModel } {
  const taxRules = effectiveTaxRulesForReadModel(quote, opts?.taxRules);
  const layers = priceSaaSQuoteLayers(quoteRecordToLayerInput(quote, taxRules));
  const mask = opts?.maskFactoryExw ?? false;
  const landedTotalUsd = Number(quote.totalPrice ?? 0);
  const pricing: QuotePricingReadModel = {
    ...layers,
    factoryExwUsd: mask ? null : layers.factoryExwUsd,
    afterVisionLatamUsd: mask ? null : layers.afterVisionLatamUsd,
    landedTotalUsd,
  };
  return { pricing };
}

/**
 * JSON-safe quote + `pricing` block. Partners: mask raw EXW / after-VL; always expose `basePriceForPartner` (VL-inclusive).
 */
export function formatQuoteForSaaSApi(
  quote: unknown,
  options: { maskFactoryExw: boolean; taxRules?: TaxRule[] }
): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
  const { pricing } = buildQuotePricingReadModel(row, {
    maskFactoryExw: options.maskFactoryExw,
    taxRules: options.taxRules,
  });
  if (options.maskFactoryExw) {
    row.factoryCostTotal = null;
    row.factoryCostUsd = null;
  }
  row.basePriceForPartner = pricing.basePriceForPartnerUsd;
  row.pricing = pricing;
  return row;
}

/**
 * Formats a quote for API responses using only `tax_rules_snapshot_json` (no runtime TaxRuleSet resolution).
 */
export function formatQuoteForSaaSApiWithSnapshot(
  quote: unknown,
  options: { maskFactoryExw: boolean }
): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
  const taxRules = requireTaxRulesSnapshotFromQuote({
    id: typeof row.id === "string" ? row.id : undefined,
    taxRulesSnapshotJson: row.taxRulesSnapshotJson,
  });
  return formatQuoteForSaaSApi(row, { ...options, taxRules });
}

/**
 * List/search path: never throw on a single bad snapshot (would empty the whole collection).
 * Missing/invalid snapshot → empty tax rules + `pricingSnapshotMissing: true`.
 */
export function formatQuoteForSaaSApiListRow(
  quote: unknown,
  options: { maskFactoryExw: boolean }
): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
  const parsed = parseTaxRulesSnapshotFromQuoteRow({
    taxRulesSnapshotJson: row.taxRulesSnapshotJson,
  });
  const formatted = formatQuoteForSaaSApi(row, {
    maskFactoryExw: options.maskFactoryExw,
    taxRules: parsed ?? [],
  });
  if (parsed == null) {
    formatted.pricingSnapshotMissing = true;
  }
  return formatted;
}

/** Same stack as SaaS `pricing`; keeps legacy New Sale field names (`factoryCostUsd`, `fobUsd`, …). */
/**
 * FOB (after partner markup) for list/summary UIs. Uses snapshot rules when valid;
 * otherwise empty rules — FOB itself does not depend on tax lines. Returns 0 if no quote.
 */
export function quoteRowFobUsd(quote: Record<string, unknown> | null | undefined): number {
  if (quote == null) return 0;
  const taxRules =
    parseTaxRulesSnapshotFromQuoteRow({ taxRulesSnapshotJson: quote.taxRulesSnapshotJson }) ?? [];
  const layers = priceSaaSQuoteLayers({
    factoryExwUsd: Number(quote.factoryCostTotal ?? 0),
    visionLatamMarkupPct: Number(quote.visionLatamMarkupPct ?? 0),
    partnerMarkupPct: Number(quote.partnerMarkupPct ?? 0),
    logisticsCostUsd: Number(quote.logisticsCost ?? 0),
    localTransportCostUsd: Number(quote.localTransportCost ?? 0),
    importCostUsd: Number(quote.importCost ?? 0),
    technicalServiceUsd: Number(quote.technicalServiceCost ?? 0),
    taxRules,
    numContainers: quoteNumContainers(quote),
  });
  const v = layers.afterPartnerMarkupUsd;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function toLegacySalesQuoteShape(
  q: Record<string, unknown>,
  opts?: { taxRules?: TaxRule[] }
): Record<string, unknown> {
  const factoryCostTotal = Number(q.factoryCostTotal ?? 0);
  const pm = Number(q.partnerMarkupPct ?? 0);
  const totalPrice = Number(q.totalPrice ?? 0);
  const taxRules = effectiveTaxRulesForReadModel(q, opts?.taxRules);
  const layers = priceSaaSQuoteLayers(quoteRecordToLayerInput(q, taxRules));
  const { pricing } = buildQuotePricingReadModel(q, { maskFactoryExw: false, taxRules });
  return {
    ...q,
    factoryCostUsd: factoryCostTotal,
    commissionPct: pm,
    commissionFixed: 0,
    fobUsd: layers.afterPartnerMarkupUsd,
    freightCostUsd: layers.freightUsd,
    cifUsd: layers.cifUsd,
    taxesFeesUsd: layers.ruleTaxesUsd + layers.technicalServiceUsd,
    landedDdpUsd: totalPrice,
    pricing,
  };
}

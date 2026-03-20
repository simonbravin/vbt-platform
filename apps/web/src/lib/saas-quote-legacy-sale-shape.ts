/**
 * Alineado con la forma que armaba `toLegacySalesQuoteShape` en GET /api/quotes,
 * usando el bloque `pricing` de GET /api/saas/quotes (sin recomputar desde snapshot).
 */
export type LegacySaleQuoteRow = {
  id: string;
  quoteNumber: string | null;
  factoryCostUsd: number;
  commissionPct: number;
  commissionFixed: number;
  fobUsd: number;
  freightCostUsd: number;
  cifUsd: number;
  taxesFeesUsd: number;
  landedDdpUsd: number;
};

type PricingBlock = {
  factoryExwUsd?: number | null;
  afterPartnerMarkupUsd?: number;
  freightUsd?: number;
  cifUsd?: number;
  ruleTaxesUsd?: number;
  technicalServiceUsd?: number;
  suggestedLandedUsd?: number;
  basePriceForPartnerUsd?: number;
};

export function saasQuoteRowToLegacySaleShape(q: Record<string, unknown>): LegacySaleQuoteRow {
  const p = (q.pricing ?? {}) as PricingBlock;
  const totalPrice = Number(q.totalPrice ?? 0);
  const partnerMarkupPct = Number(q.partnerMarkupPct ?? 0);
  const basePartnerRoot = typeof q.basePriceForPartner === "number" ? q.basePriceForPartner : null;
  const basePartner =
    basePartnerRoot ??
    (typeof p.basePriceForPartnerUsd === "number" ? p.basePriceForPartnerUsd : 0);
  const factoryRaw = p.factoryExwUsd;
  const factoryCostUsd =
    factoryRaw != null && !Number.isNaN(Number(factoryRaw)) ? Number(factoryRaw) : basePartner;

  return {
    id: String(q.id ?? ""),
    quoteNumber: q.quoteNumber != null ? String(q.quoteNumber) : null,
    factoryCostUsd,
    commissionPct: partnerMarkupPct,
    commissionFixed: 0,
    fobUsd: Number(p.afterPartnerMarkupUsd ?? 0),
    freightCostUsd: Number(p.freightUsd ?? 0),
    cifUsd: Number(p.cifUsd ?? 0),
    taxesFeesUsd: Number(p.ruleTaxesUsd ?? 0) + Number(p.technicalServiceUsd ?? 0),
    landedDdpUsd: totalPrice || Number(p.suggestedLandedUsd ?? 0),
  };
}

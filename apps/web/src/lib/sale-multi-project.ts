import type { PrismaClient } from "@vbt/db";
import {
  aggregateSaleFinancialsFromQuoteRows,
  type SaleQuoteFinancialRow,
  validateSaleProjectLinesBaselineAndClient,
} from "@vbt/core";
import { formatQuoteForSaaSApiWithSnapshot } from "@vbt/core/pricing";
import { saasQuoteRowToLegacySaleShape, type LegacySaleQuoteRow } from "@/lib/saas-quote-legacy-sale-shape";

export type ProjectLineInput = {
  projectId: string;
  quoteId?: string | null;
  containerSharePct?: number | null;
};

export type ResolvedSaleProjectLine = {
  projectId: string;
  quoteId: string;
  containerSharePct: number | null;
  sortOrder: number;
};

/**
 * Validates projects (same client, quote per line or baseline), resolves quote per line,
 * and aggregates financials the same way as single-quote New Sale (per-quote × quantity, then sum).
 */
export async function resolveMultiProjectSaleLines(
  prisma: PrismaClient,
  organizationId: string,
  clientId: string,
  lines: ProjectLineInput[],
  quantity: number,
  maskFactoryExw: boolean
): Promise<{ financials: ReturnType<typeof aggregateSaleFinancialsFromQuoteRows>; resolvedLines: ResolvedSaleProjectLine[] }> {
  if (lines.length === 0) {
    throw new Error("At least one project line is required");
  }

  const ids = [...new Set(lines.map((l) => l.projectId))];

  const projects = await prisma.project.findMany({
    where: { id: { in: ids }, organizationId },
    select: {
      id: true,
      clientId: true,
      baselineQuoteId: true,
    },
  });
  validateSaleProjectLinesBaselineAndClient(lines, projects, clientId);

  const legacyRows: LegacySaleQuoteRow[] = [];
  const resolvedLines: ResolvedSaleProjectLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const proj = projects.find((p) => p.id === line.projectId)!;
    const resolvedQuoteId = line.quoteId?.trim() || proj.baselineQuoteId;
    if (!resolvedQuoteId) {
      throw new Error("Each project line must include a quote or have a baseline quote on the project");
    }
    const quote = await prisma.quote.findFirst({
      where: { id: resolvedQuoteId, organizationId, projectId: line.projectId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) {
      throw new Error("Quote not found for a project line");
    }
    const formatted = formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw });
    const legacy = saasQuoteRowToLegacySaleShape(formatted);
    legacyRows.push(legacy);
    resolvedLines.push({
      projectId: line.projectId,
      quoteId: quote.id,
      containerSharePct: line.containerSharePct ?? null,
      sortOrder: i,
    });
  }

  const financialRows: SaleQuoteFinancialRow[] = legacyRows.map((r) => ({
    factoryCostUsd: r.factoryCostUsd,
    commissionPct: r.commissionPct,
    fobUsd: r.fobUsd,
    freightCostUsd: r.freightCostUsd,
    cifUsd: r.cifUsd,
    taxesFeesUsd: r.taxesFeesUsd,
    landedDdpUsd: r.landedDdpUsd,
  }));

  const financials = aggregateSaleFinancialsFromQuoteRows(financialRows, quantity);
  return { financials, resolvedLines };
}

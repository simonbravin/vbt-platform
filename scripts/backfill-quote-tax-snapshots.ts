/**
 * Backfill + verify quote tax snapshots (tax_rules_snapshot_json) and canonical SaaS totals.
 *
 * Usage (repo root, DATABASE_URL en .env — p.ej. packages/db/.env):
 *   pnpm run backfill:quote-tax-snapshots backfill
 *   pnpm run backfill:quote-tax-snapshots verify
 *
 * Idempotent: `backfill` only updates rows where snapshot is NULL, unless INCLUDE_INVALID_SNAPSHOT=1
 * (then also rewrites rows whose JSON fails Zod validation for TaxRule[]).
 *
 * Classification:
 *   A — countryCode + TaxRuleSet → update snapshot + recompute totals/items via canonicalizeSaaSQuotePayload
 *   B — countryCode but NO TaxRuleSet → FAILED (logged, no DB write)
 *   C — missing countryCode / country not in DB → FAILED (logged, no DB write)
 */

import { Prisma, type QuoteItemType } from "@vbt/db";
import type { TaxRule } from "@vbt/core";
import {
  canonicalizeSaaSQuotePayload,
  prismaQuoteItemsToInputs,
  resolveTaxRulesForSaaSQuote,
  QuoteTaxResolutionError,
  requireTaxRulesSnapshotFromQuote,
  isTaxRulesSnapshotJsonValid,
} from "@vbt/core";
import { prisma } from "@vbt/db";

const EPS = 0.02;
const INCLUDE_INVALID = process.env.INCLUDE_INVALID_SNAPSHOT === "1" || process.env.INCLUDE_INVALID_SNAPSHOT === "true";

type Stats = {
  examined: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: Array<{ quoteId: string; reason: string; code?: string }>;
};

type QuoteWithItems = {
  id: string;
  organizationId: string;
  factoryCostTotal: number;
  visionLatamMarkupPct: number;
  partnerMarkupPct: number;
  logisticsCost: number;
  localTransportCost: number;
  importCost: number;
  technicalServiceCost: number;
  totalPrice: number;
  items: Array<{
    itemType: string;
    sku?: string | null;
    description?: string | null;
    unit?: string | null;
    quantity: number;
    unitCost: number;
    markupPct: number;
    unitPrice: number;
    totalPrice: number;
    sortOrder: number;
    catalogPieceId?: string | null;
  }>;
};

function canonFromDbQuote(quote: QuoteWithItems, taxRules: TaxRule[]) {
  const inputs = prismaQuoteItemsToInputs(quote.items);
  return canonicalizeSaaSQuotePayload({
    items: inputs,
    headerFactoryExwUsd: inputs.length > 0 ? undefined : Number(quote.factoryCostTotal ?? 0),
    visionLatamMarkupPct: Number(quote.visionLatamMarkupPct ?? 0),
    partnerMarkupPct: Number(quote.partnerMarkupPct ?? 0),
    logisticsCostUsd: Number(quote.logisticsCost ?? 0),
    localTransportCostUsd: Number(quote.localTransportCost ?? 0),
    importCostUsd: Number(quote.importCost ?? 0),
    technicalServiceUsd: Number(quote.technicalServiceCost ?? 0),
    taxRules,
  });
}

async function persistCanon(
  tx: Prisma.TransactionClient,
  quoteId: string,
  canon: ReturnType<typeof canonicalizeSaaSQuotePayload>,
  taxRules: TaxRule[]
) {
  await tx.quote.update({
    where: { id: quoteId },
    data: {
      factoryCostTotal: canon.factoryCostTotal,
      totalPrice: canon.totalPrice,
      visionLatamMarkupPct: canon.visionLatamMarkupPct,
      partnerMarkupPct: canon.partnerMarkupPct,
      logisticsCost: canon.logisticsCostUsd,
      importCost: canon.importCostUsd,
      localTransportCost: canon.localTransportCostUsd,
      technicalServiceCost: canon.technicalServiceUsd,
      taxRulesSnapshotJson: taxRules as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.quoteItem.deleteMany({ where: { quoteId } });
  if (canon.items.length > 0) {
    await tx.quoteItem.createMany({
      data: canon.items.map((item, i) => ({
        quoteId,
        itemType: item.itemType as QuoteItemType,
        sku: item.sku ?? null,
        description: item.description ?? null,
        unit: item.unit ?? null,
        quantity: item.quantity ?? 0,
        unitCost: item.unitCost ?? 0,
        markupPct: item.markupPct ?? 0,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: item.totalPrice ?? 0,
        sortOrder: item.sortOrder ?? i,
        catalogPieceId: item.catalogPieceId ?? null,
      })),
    });
  }
}

async function runBackfill(): Promise<Stats> {
  const stats: Stats = { examined: 0, updated: 0, skipped: 0, failed: 0, failures: [] };

  const missing = await prisma.quote.findMany({
    where: { taxRulesSnapshotJson: { equals: Prisma.DbNull } },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      project: { select: { countryCode: true } },
    },
  });

  let invalid: typeof missing = [];
  if (INCLUDE_INVALID) {
    const withJson = await prisma.quote.findMany({
      where: { taxRulesSnapshotJson: { not: Prisma.DbNull } },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        project: { select: { countryCode: true } },
      },
    });
    invalid = withJson.filter((q) => !isTaxRulesSnapshotJsonValid(q.taxRulesSnapshotJson));
  }

  const targets = [...missing, ...invalid];
  stats.examined = targets.length;

  for (const quote of targets) {
    try {
      const taxRules = await resolveTaxRulesForSaaSQuote(prisma, {
        organizationId: quote.organizationId,
        projectCountryCode: quote.project?.countryCode,
      });
      const canon = canonFromDbQuote(quote, taxRules);
      await prisma.$transaction((tx) => persistCanon(tx, quote.id, canon, taxRules));
      stats.updated += 1;
      console.log(
        JSON.stringify({
          level: "OK",
          quoteId: quote.id,
          action: "updated",
          totalPrice: canon.totalPrice,
        })
      );
    } catch (e) {
      stats.failed += 1;
      if (e instanceof QuoteTaxResolutionError) {
        const row = { quoteId: quote.id, reason: e.message, code: e.code };
        stats.failures.push(row);
        console.error(JSON.stringify({ level: "FAIL", ...row }));
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        const row = { quoteId: quote.id, reason: msg };
        stats.failures.push(row);
        console.error(JSON.stringify({ level: "FAIL", ...row }));
      }
    }
  }

  return stats;
}

async function runVerify(): Promise<{
  missingSnapshot: number;
  invalidSnapshot: number;
  totalMismatch: number;
  samples: Array<{ quoteId: string; issue: string; detail?: string }>;
}> {
  const samples: Array<{ quoteId: string; issue: string; detail?: string }> = [];

  const missingSnapshot = await prisma.quote.count({
    where: { taxRulesSnapshotJson: { equals: Prisma.DbNull } },
  });
  if (missingSnapshot > 0) {
    const ids = await prisma.quote.findMany({
      where: { taxRulesSnapshotJson: { equals: Prisma.DbNull } },
      select: { id: true },
      take: 20,
    });
    for (const { id } of ids) {
      samples.push({ quoteId: id, issue: "MISSING_SNAPSHOT" });
    }
  }

  const withJson = await prisma.quote.findMany({
    where: { taxRulesSnapshotJson: { not: Prisma.DbNull } },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  let invalidSnapshot = 0;
  let totalMismatch = 0;

  for (const q of withJson) {
    let taxRules: TaxRule[];
    try {
      taxRules = requireTaxRulesSnapshotFromQuote({ id: q.id, taxRulesSnapshotJson: q.taxRulesSnapshotJson });
    } catch (e) {
      invalidSnapshot += 1;
      if (samples.length < 40) {
        samples.push({
          quoteId: q.id,
          issue: "INVALID_SNAPSHOT",
          detail: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    const canon = canonFromDbQuote(q, taxRules);
    const tDiff = Math.abs(canon.totalPrice - Number(q.totalPrice ?? 0));
    const fDiff = Math.abs(canon.factoryCostTotal - Number(q.factoryCostTotal ?? 0));
    if (tDiff > EPS || fDiff > EPS) {
      totalMismatch += 1;
      if (samples.length < 40) {
        samples.push({
          quoteId: q.id,
          issue: "TOTAL_MISMATCH",
          detail: `storedTotal=${q.totalPrice} canonTotal=${canon.totalPrice} storedFactory=${q.factoryCostTotal} canonFactory=${canon.factoryCostTotal}`,
        });
      }
    }
  }

  return { missingSnapshot, invalidSnapshot, totalMismatch, samples };
}

async function main() {
  const mode = process.argv[2] ?? "verify";
  if (mode === "backfill") {
    console.error(JSON.stringify({ level: "INFO", event: "backfill_start", includeInvalid: INCLUDE_INVALID }));
    const stats = await runBackfill();
    console.log(
      JSON.stringify({
        level: "SUMMARY",
        event: "backfill_complete",
        examined: stats.examined,
        updated: stats.updated,
        failed: stats.failed,
        failureCount: stats.failures.length,
      })
    );
    if (stats.failed > 0) {
      process.exitCode = 2;
    }
  } else if (mode === "verify") {
    const v = await runVerify();
    const ok = v.missingSnapshot === 0 && v.invalidSnapshot === 0 && v.totalMismatch === 0;
    console.log(
      JSON.stringify({
        level: "SUMMARY",
        event: "verify_complete",
        missingSnapshot: v.missingSnapshot,
        invalidSnapshot: v.invalidSnapshot,
        totalMismatch: v.totalMismatch,
        pass: ok,
        samples: v.samples,
      })
    );
    if (!ok) {
      process.exitCode = 1;
    }
  } else {
    console.error("Usage: pnpm run backfill:quote-tax-snapshots backfill|verify");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

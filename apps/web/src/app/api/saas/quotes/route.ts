/**
 * Canonical SaaS quotes collection (`listQuotes` / `createQuote` from `@vbt/core`).
 * All persisted money fields flow through `canonicalizeSaaSQuotePayload` (single SaaS pricing path).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import {
  listQuotes,
  createQuote,
  normalizeQuoteStatus,
  formatQuoteForSaaSApiWithSnapshot,
  canonicalizeSaaSQuotePayload,
  resolveTaxRulesForSaaSQuote,
  QuoteTaxResolutionError,
  resolvePartnerPricingConfig,
  resolveSaaSQuotePricingForCreate,
  projectHasCompletedEngineering,
  assertEngineeringRequestForQuote,
} from "@vbt/core";
import type { Prisma } from "@vbt/db";
import { createQuoteSchema } from "@vbt/core/validation";
import { generateQuoteNumber } from "@/lib/utils";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
      throw new TenantError("No active organization", "NO_ACTIVE_ORG");
    }
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const offsetRaw = url.searchParams.get("offset");
    const limit = limitRaw != null && limitRaw !== "" ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 50)) : 50;
    const offset = offsetRaw != null && offsetRaw !== "" ? Math.max(0, parseInt(offsetRaw, 10) || 0) : 0;
    const statusRaw = url.searchParams.get("status") || undefined;
    const status =
      statusRaw && statusRaw.trim() ? normalizeQuoteStatus(statusRaw) ?? undefined : undefined;
    const search = url.searchParams.get("search") || undefined;
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const organizationId = url.searchParams.get("organizationId") || undefined;

    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin,
    };
    const result = await listQuotes(prisma, tenantCtx, {
      projectId,
      organizationId: organizationId || undefined,
      status,
      search: search || undefined,
      limit,
      offset,
    });
    const quotes = result.quotes.map((q) =>
      formatQuoteForSaaSApiWithSnapshot(q, { maskFactoryExw: !ctx.isPlatformSuperadmin })
    );
    return NextResponse.json({ quotes, total: result.total });
  } catch (e) {
    console.error("[api/saas/quotes GET]", e);
    return NextResponse.json(
      { quotes: [], total: 0, error: true, message: "Failed to load quotes. Please try again." },
      { status: 200 }
    );
  }
}

async function postHandler(req: Request) {
  const user = await requireActiveOrg();
  const body = await req.json();
  const parsed = createQuoteSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const data = parsed.data;
  const quoteNumber = data.quoteNumber ?? generateQuoteNumber();
  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: user.isPlatformSuperadmin,
  };
  const projectOrg = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { organizationId: true, countryCode: true },
  });
  const orgId = tenantCtx.organizationId ?? projectOrg?.organizationId ?? null;
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization could not be resolved for this quote (project may be invalid)." },
      { status: 400 }
    );
  }
  const quoteCtx = { ...tenantCtx, organizationId: orgId };

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { organizationId: orgId },
    select: { requireDeliveredEngineeringForQuotes: true },
  });
  if (partnerProfile?.requireDeliveredEngineeringForQuotes) {
    const ok = await projectHasCompletedEngineering(prisma, orgId, data.projectId);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "This partner requires at least one completed engineering request for the project before creating quotes.",
          code: "ENGINEERING_NOT_DELIVERED",
        },
        { status: 400 }
      );
    }
  }

  try {
    await assertEngineeringRequestForQuote(prisma, orgId, data.projectId, data.engineeringRequestId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid engineering request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let taxRules;
  try {
    taxRules = await resolveTaxRulesForSaaSQuote(prisma, {
      organizationId: orgId,
      projectCountryCode: projectOrg?.countryCode,
    });
  } catch (e) {
    if (e instanceof QuoteTaxResolutionError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }

  const resolved = await resolvePartnerPricingConfig(prisma, {
    organizationId: orgId,
    projectCountryCode: projectOrg?.countryCode,
  });
  const pricingInputs = resolveSaaSQuotePricingForCreate({
    isSuperadmin: !!tenantCtx.isPlatformSuperadmin,
    explicit: {
      visionLatamMarkupPct: data.visionLatamMarkupPct,
      partnerMarkupPct: data.partnerMarkupPct,
      logisticsCost: data.logisticsCost,
      importCost: data.importCost,
      localTransportCost: data.localTransportCost,
      technicalServiceCost: data.technicalServiceCost,
    },
    resolved,
  });

  const hasLines = (data.items?.length ?? 0) > 0;
  const canon = canonicalizeSaaSQuotePayload({
    items: data.items,
    headerFactoryExwUsd: hasLines ? undefined : data.factoryCostTotal,
    visionLatamMarkupPct: pricingInputs.visionLatamMarkupPct,
    partnerMarkupPct: pricingInputs.partnerMarkupPct,
    logisticsCostUsd: pricingInputs.logisticsCostUsd,
    localTransportCostUsd: pricingInputs.localTransportCostUsd,
    importCostUsd: pricingInputs.importCostUsd,
    technicalServiceUsd: pricingInputs.technicalServiceUsd,
    taxRules,
  });

  const quote = await createQuote(prisma, quoteCtx, {
    ...data,
    quoteNumber,
    visionLatamMarkupPct: canon.visionLatamMarkupPct,
    partnerMarkupPct: canon.partnerMarkupPct,
    logisticsCost: canon.logisticsCostUsd,
    importCost: canon.importCostUsd,
    localTransportCost: canon.localTransportCostUsd,
    technicalServiceCost: canon.technicalServiceUsd,
    factoryCostTotal: canon.factoryCostTotal,
    totalPrice: canon.totalPrice,
    items: canon.items,
    engineeringRequestId: data.engineeringRequestId ?? null,
    taxRulesSnapshotJson: taxRules as unknown as Prisma.InputJsonValue,
  });

  await createActivityLog({
    organizationId: user.activeOrgId ?? null,
    userId: user.userId ?? user.id,
    action: "quote_created",
    entityType: "quote",
    entityId: quote.id,
    metadata: { quoteNumber, projectId: data.projectId },
  });
  return NextResponse.json(formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: !user.isPlatformSuperadmin }), {
    status: 201,
  });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

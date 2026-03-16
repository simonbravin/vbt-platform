import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { listQuotes, createQuote, getVisionLatamCommissionPctForOrg } from "@vbt/core";
import { createQuoteSchema } from "@vbt/core/validation";
import { generateQuoteNumber } from "@/lib/utils";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = limitRaw != null && limitRaw !== "" ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 50)) : 50;
  const offset = offsetRaw != null && offsetRaw !== "" ? Math.max(0, parseInt(offsetRaw, 10) || 0) : 0;
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  let result: Awaited<ReturnType<typeof listQuotes>>;
  try {
    result = await listQuotes(prisma, tenantCtx, {
      projectId,
      status: status as "draft" | "sent" | "accepted" | "rejected" | "expired" | undefined,
      search: search || undefined,
      limit,
      offset,
    });
  } catch (e) {
    console.error("[api/saas/quotes GET] listQuotes error:", e);
    return NextResponse.json(
      { error: "Failed to load quotes" },
      { status: 500 }
    );
  }
  // Partners must not see factory cost; expose basePriceForPartner using quote's stored VL %
  if (!ctx.isPlatformSuperadmin && result.quotes.length > 0) {
    const quotes = result.quotes.map((q) => {
      const factory = Number((q as { factoryCostTotal?: number }).factoryCostTotal ?? 0);
      const pct = Number((q as { visionLatamMarkupPct?: number }).visionLatamMarkupPct ?? 0);
      const payload = JSON.parse(JSON.stringify(q)) as Record<string, unknown>;
      payload.factoryCostTotal = null;
      payload.factoryCostUsd = null;
      payload.basePriceForPartner = factory * (1 + pct / 100);
      return payload;
    });
    return NextResponse.json({ quotes, total: result.total });
  }
  return NextResponse.json(result);
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
  // Resolve org for the quote (tenant org or project's org when superadmin creates without active org)
  const projectOrg = await prisma.project.findUnique({ where: { id: data.projectId }, select: { organizationId: true } });
  const orgId = tenantCtx.organizationId ?? projectOrg?.organizationId ?? null;
  const visionLatamMarkupPct =
    tenantCtx.isPlatformSuperadmin && data.visionLatamMarkupPct != null
      ? data.visionLatamMarkupPct
      : orgId
        ? await getVisionLatamCommissionPctForOrg(prisma, orgId)
        : 20;
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization could not be resolved for this quote (project may be invalid)." },
      { status: 400 }
    );
  }
  // When superadmin has no active org, pass project's org so the quote is created with correct organizationId
  const quoteCtx = { ...tenantCtx, organizationId: orgId };
  const quote = await createQuote(prisma, quoteCtx, {
    ...data,
    quoteNumber,
    visionLatamMarkupPct,
    items: data.items,
  });
  await createActivityLog({
    organizationId: user.activeOrgId ?? null,
    userId: user.userId ?? user.id,
    action: "quote_created",
    entityType: "quote",
    entityId: quote.id,
    metadata: { quoteNumber, projectId: data.projectId },
  });
  return NextResponse.json(quote, { status: 201 });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

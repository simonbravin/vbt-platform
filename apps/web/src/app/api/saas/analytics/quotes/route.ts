import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getQuoteAnalytics } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";
import { analyticsQuotesQuerySchema } from "@vbt/core/validation";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
  };
  const url = new URL(req.url);
  const parsed = analyticsQuotesQuerySchema.safeParse({
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
  });
  if (!parsed.success) throw parsed.error;
  const { dateFrom, dateTo } = parsed.data;
  try {
    const result = await getQuoteAnalytics(prisma, tenantCtx, {
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[analytics/quotes]", e);
    return NextResponse.json({
      quotes_created: 0,
      quotes_sent: 0,
      quotes_accepted: 0,
      quotes_rejected: 0,
      average_quote_value: 0,
      conversion_rate: 0,
      average_sales_cycle_days: 0,
    });
  }
}

export const GET = withSaaSHandler({ cacheTtl: CACHE_TTL.analytics }, getHandler);

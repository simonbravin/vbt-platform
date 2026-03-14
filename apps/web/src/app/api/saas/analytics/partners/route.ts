import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getPartnerPerformance } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";
import { analyticsPartnersQuerySchema } from "@vbt/core/validation";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
  };
  const url = new URL(req.url);
  const parsed = analyticsPartnersQuerySchema.safeParse({
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    partnerId: url.searchParams.get("partnerId") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
  });
  if (!parsed.success) throw parsed.error;
  const { dateFrom, dateTo, partnerId, country } = parsed.data;
  const result = await getPartnerPerformance(prisma, tenantCtx, {
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    partnerId,
    country,
  });
  return NextResponse.json(result);
}

export const GET = withSaaSHandler({ cacheTtl: CACHE_TTL.analytics }, getHandler);

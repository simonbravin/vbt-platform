import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getPartnerLeaderboard } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";
import { analyticsLeaderboardQuerySchema } from "@vbt/core/validation";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
  };
  const url = new URL(req.url);
  const parsed = analyticsLeaderboardQuerySchema.safeParse({
    sort: url.searchParams.get("sort") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
  });
  if (!parsed.success) throw parsed.error;
  const { sort, limit, dateFrom, dateTo } = parsed.data;
  const result = await getPartnerLeaderboard(prisma, tenantCtx, {
    sort: sort ?? "revenue",
    limit: limit ?? 20,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });
  return NextResponse.json(result);
}

export const GET = withSaaSHandler({ cacheTtl: CACHE_TTL.leaderboard }, getHandler);

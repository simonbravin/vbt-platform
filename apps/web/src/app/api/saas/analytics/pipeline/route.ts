import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getPipelineAnalytics } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";

async function getHandler() {
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
  try {
    const result = await getPipelineAnalytics(prisma, tenantCtx);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[analytics/pipeline]", e);
    return NextResponse.json({
      projects_total: 0,
      projects_by_status: {},
      quotes_total: 0,
      quotes_by_status: {},
      quotes_value_pipeline: 0,
      quotes_value_won: 0,
      quotes_value_lost: 0,
    });
  }
}

export const GET = withSaaSHandler({ cacheTtl: CACHE_TTL.analytics }, async () => getHandler());

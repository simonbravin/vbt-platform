import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getDashboardOverview } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";

const EMPTY_OVERVIEW = {
  projects_total: 0,
  quotes_total: 0,
  quotes_pipeline_value: 0,
  quotes_won_value: 0,
};

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
    const result = await getDashboardOverview(prisma, tenantCtx);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[dashboard/overview]", e);
    return NextResponse.json(EMPTY_OVERVIEW);
  }
}

export const GET = withSaaSHandler({ cacheTtl: CACHE_TTL.dashboard }, async () => getHandler());

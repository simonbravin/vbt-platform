import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getRecentProjects } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";
import { dashboardLimitQuerySchema } from "@vbt/core/validation";

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
  const parsed = dashboardLimitQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  });
  const limit = parsed.success && parsed.data.limit != null ? parsed.data.limit : 10;
  const result = await getRecentProjects(prisma, tenantCtx, limit);
  return NextResponse.json(result);
}

export const GET = withSaaSHandler({ cacheTtl: CACHE_TTL.dashboard }, getHandler);

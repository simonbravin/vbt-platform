import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { listLevels } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const organizationId = url.searchParams.get("organizationId") || undefined;
  const catalogPieceId = url.searchParams.get("catalogPieceId") || undefined;
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const result = await listLevels(prisma, tenantCtx, {
    warehouseId,
    organizationId,
    catalogPieceId,
    limit: limit ? Math.min(200, Math.max(1, parseInt(limit, 10) || 50)) : undefined,
    offset: offset ? Math.max(0, parseInt(offset, 10) || 0) : undefined,
  });
  return NextResponse.json(result);
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);

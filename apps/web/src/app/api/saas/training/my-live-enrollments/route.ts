import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { listMyLiveSessionEnrollments } from "@vbt/core";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const url = new URL(req.url);
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const result = await listMyLiveSessionEnrollments(prisma, tenantCtx, {
    limit: Number(url.searchParams.get("limit")) || 50,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

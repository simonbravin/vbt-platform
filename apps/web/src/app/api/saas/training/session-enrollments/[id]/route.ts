import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { cancelLiveSessionEnrollment } from "@vbt/core";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  try {
    const enrollment = await cancelLiveSessionEnrollment(prisma, tenantCtx, params.id);
    return NextResponse.json(enrollment);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

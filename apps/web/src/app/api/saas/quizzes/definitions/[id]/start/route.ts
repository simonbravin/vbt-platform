import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { startQuizAttempt } from "@vbt/core";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  try {
    const result = await startQuizAttempt(prisma, tenantCtx, params.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

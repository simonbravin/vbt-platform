import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import { enrollInLiveSession, listLiveSessionEnrollments } from "@vbt/core";
import { enrollLiveSessionSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const url = new URL(req.url);
  const result = await listLiveSessionEnrollments(prisma, params.id, {
    limit: Number(url.searchParams.get("limit")) || 200,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = enrollLiveSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  try {
    const enrollment = await enrollInLiveSession(
      prisma,
      tenantCtx,
      params.id,
      parsed.data.userId
    );
    await createActivityLog({
      organizationId: ctx.activeOrgId,
      userId: ctx.userId,
      action: "training_session_enrolled",
      entityType: "training_session_enrollment",
      entityId: enrollment.id,
      metadata: { liveSessionId: params.id },
    });
    return NextResponse.json(enrollment, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

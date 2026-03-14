import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { listTrainingEnrollments, enrollInProgram } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const enrollSchema = z.object({ programId: z.string(), userId: z.string().optional() });

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }
    const url = new URL(req.url);
    const tenantCtx = { userId: ctx.userId, organizationId: ctx.activeOrgId ?? null, isPlatformSuperadmin: ctx.isPlatformSuperadmin };
    const result = await listTrainingEnrollments(prisma, tenantCtx, {
      userId: url.searchParams.get("userId") ?? undefined,
      programId: url.searchParams.get("programId") ?? undefined,
      status: url.searchParams.get("status") as any,
      limit: Number(url.searchParams.get("limit")) || 50,
      offset: Number(url.searchParams.get("offset")) || 0,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("GET /api/saas/training/enrollments error:", e);
    return NextResponse.json({ enrollments: [], total: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
    };
    const enrollment = await enrollInProgram(
      prisma,
      tenantCtx,
      parsed.data.programId,
      parsed.data.userId
    );
    await createActivityLog({
      organizationId: ctx.activeOrgId,
      userId: ctx.userId,
      action: "training_enrolled",
      entityType: "training_enrollment",
      entityId: enrollment.id,
      metadata: { programId: parsed.data.programId, userId: enrollment.userId },
    });
    return NextResponse.json(enrollment, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { updateEnrollmentProgress } from "@vbt/core";
import { z } from "zod";

const ENROLLMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;

const patchSchema = z.object({
  progressPercent: z.number().min(0).max(100).optional(),
  progressPct: z.number().min(0).max(100).optional(),
  status: z.enum(ENROLLMENT_STATUSES).optional(),
  completedAt: z.string().datetime().nullable().optional().or(z.null()),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin,
    };
    const data = parsed.data;
    const enrollment = await updateEnrollmentProgress(prisma, tenantCtx, params.id, {
      progressPct: data.progressPct ?? data.progressPercent,
      status: data.status,
      completedAt:
        data.completedAt === null
          ? null
          : data.completedAt
            ? new Date(data.completedAt as string)
            : undefined,
    });
    return NextResponse.json(enrollment);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

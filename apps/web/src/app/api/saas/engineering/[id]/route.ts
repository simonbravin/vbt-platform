import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getEngineeringRequestById, updateEngineeringRequest } from "@vbt/core";
import { z } from "zod";

const ENGINEERING_STATUSES = ["draft", "submitted", "in_review", "pending_info", "needs_info", "in_progress", "completed", "delivered", "rejected"] as const;

const patchSchema = z.object({
  status: z.enum(ENGINEERING_STATUSES).optional(),
  assignedToUserId: z.string().nullable().optional(),
  requestType: z.string().nullable().optional(),
  wallAreaM2: z.number().nullable().optional(),
  systemType: z.string().nullable().optional(),
  targetDeliveryDate: z.string().datetime().nullable().optional().or(z.string().nullable()),
  engineeringFeeValue: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin,
    };
    const request = await getEngineeringRequestById(prisma, tenantCtx, params.id, {
      includeInternalReviews: !!ctx.isPlatformSuperadmin,
    });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(request);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

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
    const isSuperadmin = !!user.isPlatformSuperadmin;
    const assignedToUserId = isSuperadmin ? data.assignedToUserId : undefined;
    const request = await updateEngineeringRequest(prisma, tenantCtx, params.id, {
      status: data.status,
      assignedToUserId,
      requestType: data.requestType,
      wallAreaM2: data.wallAreaM2,
      systemType: data.systemType,
      targetDeliveryDate:
        data.targetDeliveryDate === undefined
          ? undefined
          : data.targetDeliveryDate == null || data.targetDeliveryDate === ""
            ? null
            : new Date(data.targetDeliveryDate as string),
      engineeringFeeValue: data.engineeringFeeValue,
      notes: data.notes,
    });
    return NextResponse.json(request);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getEngineeringRequestById, updateEngineeringRequest } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { sendEngineeringAssigneeEmail, sendPartnerEngineeringEventEmail } from "@/lib/engineering-email";
import { z } from "zod";

const ENGINEERING_STATUSES = ["draft", "in_review", "completed"] as const;

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

    const before = await prisma.engineeringRequest.findUnique({
      where: { id: params.id },
      select: { organizationId: true, status: true, assignedToUserId: true },
    });

    await updateEngineeringRequest(prisma, tenantCtx, params.id, {
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
    const refreshed = await getEngineeringRequestById(prisma, tenantCtx, params.id, {
      includeInternalReviews: isSuperadmin,
    });
    if (!refreshed) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (before?.organizationId) {
      if (data.status != null && data.status !== before.status) {
        await createActivityLog({
          organizationId: before.organizationId,
          userId: user.userId ?? user.id,
          action: "engineering_status_changed",
          entityType: "engineering_request",
          entityId: params.id,
          metadata: { fromStatus: before.status, toStatus: data.status },
        });
      }
      if (
        isSuperadmin &&
        data.assignedToUserId !== undefined &&
        (data.assignedToUserId ?? null) !== (before.assignedToUserId ?? null)
      ) {
        await createActivityLog({
          organizationId: before.organizationId,
          userId: user.userId ?? user.id,
          action: "engineering_assignment_changed",
          entityType: "engineering_request",
          entityId: params.id,
          metadata: { assignedToUserId: data.assignedToUserId },
        });
      }
    }

    if (before?.organizationId && data.status != null && data.status !== before.status) {
      const oid = before.organizationId;
      if (data.status === "completed") {
        void sendPartnerEngineeringEventEmail({
          organizationId: oid,
          event: "delivered",
          requestId: params.id,
        }).catch((err) => console.warn("[engineering email] completed", err));
      }
    }
    if (
      isSuperadmin &&
      data.assignedToUserId &&
      data.assignedToUserId !== before?.assignedToUserId
    ) {
      void sendEngineeringAssigneeEmail({
        assigneeUserId: data.assignedToUserId,
        requestId: params.id,
      }).catch((err) => console.warn("[engineering email] assignee", err));
    }

    return NextResponse.json(refreshed);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

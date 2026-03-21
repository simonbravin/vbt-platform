import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { addEngineeringReviewEvent, getEngineeringRequestById } from "@vbt/core";
import { createEngineeringReviewEventSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = createEngineeringReviewEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: !!user.isPlatformSuperadmin,
    };
    try {
      await addEngineeringReviewEvent(prisma, tenantCtx, params.id, {
        body: parsed.data.body,
        visibility: parsed.data.visibility,
        toStatus: parsed.data.toStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add review note";
      const status = msg.includes("Forbidden") || msg.includes("only") || msg.includes("Invalid") ? 403 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
    const refreshed = await getEngineeringRequestById(prisma, tenantCtx, params.id, {
      includeInternalReviews: !!user.isPlatformSuperadmin,
    });
    await createActivityLog({
      organizationId: user.activeOrgId ?? refreshed?.organizationId ?? null,
      userId: user.userId ?? user.id,
      action: "engineering_review_event_created",
      entityType: "engineering_request",
      entityId: params.id,
      metadata: { visibility: parsed.data.visibility },
    });
    return NextResponse.json(refreshed, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

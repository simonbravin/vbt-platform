import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { updateOrgMember, removeOrgMember, ORG_ROLE_TO_API } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const ROLES = ["owner", "admin", "sales", "engineer", "viewer"] as const;

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "inactive", "invited", "suspended"]).optional(),
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
    const member = await updateOrgMember(prisma, tenantCtx, params.id, parsed.data);
    if (parsed.data.role != null) {
      await createActivityLog({
        organizationId: user.activeOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "member_role_changed",
        entityType: "org_member",
        entityId: member.id,
        metadata: { userId: member.userId, role: parsed.data.role },
      });
    }
    return NextResponse.json({
      ...member,
      role: ORG_ROLE_TO_API[member.role] ?? member.role,
    });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Member not found") {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireActiveOrg();
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin,
    };
    const result = await removeOrgMember(prisma, tenantCtx, params.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Member not found") {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    throw e;
  }
}

/**
 * CANONICAL SaaS project by id. Legacy: `/api/projects/[id]`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getTenantContext,
  requireActiveOrg,
  requireOrgRole,
  TenantError,
  tenantErrorStatus,
} from "@/lib/tenant";
import { getProjectById, updateProject } from "@vbt/core";
import { updateProjectSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";
import type { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin,
    };
    const project = await getProjectById(prisma, tenantCtx, params.id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

function normalizePatchData(
  data: z.infer<typeof updateProjectSchema>
): Parameters<typeof updateProject>[3] {
  const out: Record<string, unknown> = { ...data };
  if (data.expectedCloseDate === null) {
    out.expectedCloseDate = null;
  } else if (data.expectedCloseDate !== undefined && typeof data.expectedCloseDate === "string") {
    out.expectedCloseDate = new Date(data.expectedCloseDate);
  }
  return out as Parameters<typeof updateProject>[3];
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireOrgRole(["org_admin", "sales_user", "technical_user"]);
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
    }
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
    };
    const payload = normalizePatchData(parsed.data);
    const project = await updateProject(prisma, tenantCtx, params.id, payload);

    await createActivityLog({
      organizationId: user.activeOrgId ?? undefined,
      userId: user.id,
      action: "PROJECT_UPDATED",
      entityType: "Project",
      entityId: params.id,
      metadata: { changed: Object.keys(parsed.data) },
    });

    return NextResponse.json(project);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireOrgRole(["org_admin"]);
    const user = await requireActiveOrg();
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
    };
    const project = await getProjectById(prisma, tenantCtx, params.id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await createActivityLog({
      organizationId: user.activeOrgId ?? undefined,
      userId: user.id,
      action: "PROJECT_DELETED",
      entityType: "Project",
      entityId: params.id,
      metadata: { projectName: project.projectName },
    });

    await prisma.project.update({
      where: { id: params.id },
      data: { status: "lost" },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

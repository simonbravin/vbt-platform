import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, requireOrgRole, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getProjectById, updateProject } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const projectStatusEnum = z.enum(["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"]);

const updateSchema = z.object({
  projectName: z.string().min(1).optional(),
  projectCode: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  status: projectStatusEnum.optional(),
  estimatedTotalAreaM2: z.number().min(0).nullable().optional(),
  estimatedWallAreaM2: z.number().min(0).nullable().optional(),
  probabilityPct: z.number().min(0).max(100).nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
}).partial();

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
      isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
    };
    const project = await getProjectById(prisma, tenantCtx, params.id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(project);
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
    await requireOrgRole(["org_admin", "sales_user", "technical_user"]);
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const data = parsed.data as Record<string, unknown>;
    if (data.expectedCloseDate !== undefined && data.expectedCloseDate !== null && typeof data.expectedCloseDate === "string") {
      data.expectedCloseDate = new Date(data.expectedCloseDate as string);
    }

    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
    };
    const project = await updateProject(prisma, tenantCtx, params.id, data);

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

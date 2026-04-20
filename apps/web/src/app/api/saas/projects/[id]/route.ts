/**
 * CANONICAL SaaS project by id. Legacy: `/api/projects/[id]`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, requireOrgRole, TenantError } from "@/lib/tenant";
import { getProjectById, updateProject } from "@vbt/core";
import { updateProjectSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";
import type { z } from "zod";

type RouteCtx = { params: Promise<{ id: string }> | { id: string } };

async function projectIdFromCtx(routeContext: unknown): Promise<string> {
  const p = (routeContext as RouteCtx).params;
  return (p instanceof Promise ? await p : p).id;
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

async function getHandler(_req: Request, routeContext: unknown) {
  const id = await projectIdFromCtx(routeContext);
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const project = await getProjectById(prisma, tenantCtx, id);
  if (!project) throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Project not found");
  return NextResponse.json(project);
}

async function patchHandler(req: Request, routeContext: unknown) {
  await requireOrgRole(["org_admin", "sales_user", "technical_user"]);
  const user = await requireActiveOrg();
  const id = await projectIdFromCtx(routeContext);
  const body = await req.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Validation failed", parsed.error.issues.map((i) => ({
      path: i.path.join(".") || undefined,
      message: i.message,
    })));
  }
  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
  };
  const payload = normalizePatchData(parsed.data);
  const project = await updateProject(prisma, tenantCtx, id, payload);

  await createActivityLog({
    organizationId: user.activeOrgId ?? undefined,
    userId: user.id,
    action: "PROJECT_UPDATED",
    entityType: "Project",
    entityId: id,
    metadata: { changed: Object.keys(parsed.data) },
  });

  return NextResponse.json(project);
}

async function deleteHandler(_req: Request, routeContext: unknown) {
  await requireOrgRole(["org_admin"]);
  const user = await requireActiveOrg();
  const id = await projectIdFromCtx(routeContext);
  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
  };
  const project = await getProjectById(prisma, tenantCtx, id);
  if (!project) throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Project not found");

  await createActivityLog({
    organizationId: user.activeOrgId ?? undefined,
    userId: user.id,
    action: "PROJECT_ARCHIVED",
    entityType: "Project",
    entityId: id,
    metadata: { projectName: project.projectName },
  });

  await prisma.project.update({
    where: { id },
    data: { status: "lost" },
  });

  return NextResponse.json({ success: true });
}

export const GET = withSaaSHandler({ module: "projects", rateLimitTier: "read" }, getHandler);
export const PATCH = withSaaSHandler({ module: "projects", rateLimitTier: "create_update" }, patchHandler);
export const DELETE = withSaaSHandler({ module: "projects", rateLimitTier: "create_update" }, deleteHandler);

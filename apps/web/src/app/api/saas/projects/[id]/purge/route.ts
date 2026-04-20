/**
 * Permanent project removal (safe subset: no sales / sale-project lines). Canonical SaaS.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, requireOrgRole } from "@/lib/tenant";
import {
  getProjectById,
  permanentlyDeleteProject,
  ProjectPermanentDeleteBlockedError,
} from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";

type RouteCtx = { params: Promise<{ id: string }> | { id: string } };

async function projectIdFromCtx(routeContext: unknown): Promise<string> {
  const p = (routeContext as RouteCtx).params;
  return (p instanceof Promise ? await p : p).id;
}

async function postHandler(_req: Request, routeContext: unknown) {
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

  try {
    await permanentlyDeleteProject(prisma, tenantCtx, id);
  } catch (e) {
    const blocked =
      e instanceof ProjectPermanentDeleteBlockedError ||
      (typeof e === "object" && e !== null && (e as { code?: string }).code === "PROJECT_HAS_SALES");
    if (blocked) {
      const message = e instanceof Error ? e.message : "Project has linked sales or sale lines";
      throw new ApiHttpError(409, "PROJECT_HAS_SALES", message);
    }
    if (e instanceof Error && e.message === "Project not found") {
      throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Project not found");
    }
    throw e;
  }

  await createActivityLog({
    organizationId: user.activeOrgId ?? undefined,
    userId: user.id,
    action: "PROJECT_PURGED",
    entityType: "Project",
    entityId: id,
    metadata: { projectName: project.projectName },
  });

  return NextResponse.json({ success: true });
}

export const POST = withSaaSHandler({ module: "projects", rateLimitTier: "create_update" }, postHandler);

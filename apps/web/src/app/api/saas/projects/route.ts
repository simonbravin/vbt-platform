/**
 * CANONICAL SaaS projects collection (`listProjects` / `createProject`). Legacy: `/api/projects`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, TenantError } from "@/lib/tenant";
import { listProjects, createProject } from "@vbt/core";
import { createProjectSchema, listProjectsQuerySchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
      throw new TenantError("No active organization", "NO_ACTIVE_ORG");
    }
    const url = new URL(req.url);
    const parsed = listProjectsQuerySchema.safeParse({
      status: url.searchParams.get("status") || undefined,
      clientId: url.searchParams.get("clientId") || undefined,
      organizationId: url.searchParams.get("organizationId") || undefined,
      countryCode: url.searchParams.get("countryCode") || undefined,
      search: url.searchParams.get("search") || undefined,
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });
    if (!parsed.success) throw parsed.error;
    const tenantCtx = {
      userId: ctx!.userId,
      organizationId: ctx!.activeOrgId ?? null,
      isPlatformSuperadmin: ctx!.isPlatformSuperadmin,
    };
    const result = await listProjects(prisma, tenantCtx, {
      status: parsed.data.status,
      clientId: parsed.data.clientId,
      organizationId: parsed.data.organizationId,
      countryCode: parsed.data.countryCode,
      search: parsed.data.search,
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TenantError) throw e;
    console.error("[api/saas/projects GET]", e);
    return NextResponse.json(
      { projects: [], total: 0, error: true, message: "Failed to load projects. Please try again." },
      { status: 200 }
    );
  }
}

async function postHandler(req: Request) {
  const user = await requireActiveOrg();
  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: user.isPlatformSuperadmin,
  };
  const input = {
    ...parsed.data,
    expectedCloseDate: parsed.data.expectedCloseDate
      ? new Date(parsed.data.expectedCloseDate)
      : undefined,
  };
  try {
    const project = await createProject(prisma, tenantCtx, input);
    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Client does not belong")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

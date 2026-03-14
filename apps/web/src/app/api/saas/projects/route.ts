import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { listProjects, createProject } from "@vbt/core";
import { createProjectSchema, listProjectsQuerySchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  const url = new URL(req.url);
  const parsed = listProjectsQuerySchema.safeParse({
    status: url.searchParams.get("status") || undefined,
    clientId: url.searchParams.get("clientId") || undefined,
    search: url.searchParams.get("search") || undefined,
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });
  if (!parsed.success) throw parsed.error;
  const tenantCtx = {
    userId: ctx!.userId,
    organizationId: ctx!.activeOrgId,
    isPlatformSuperadmin: ctx!.isPlatformSuperadmin,
  };
  const result = await listProjects(prisma, tenantCtx, {
    status: parsed.data.status,
    clientId: parsed.data.clientId,
    search: parsed.data.search,
    limit: parsed.data.limit ?? 50,
    offset: parsed.data.offset ?? 0,
  });
  return NextResponse.json(result);
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
  const project = await createProject(prisma, tenantCtx, input);
  return NextResponse.json(project, { status: 201 });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

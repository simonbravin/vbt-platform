import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { listEngineeringRequests, createEngineeringRequest } from "@vbt/core";
import { createEngineeringRequestSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";

const ENGINEERING_STATUSES = ["draft", "in_review", "completed"] as const;

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  const url = new URL(req.url);
  const tenantCtx = { userId: ctx.userId, organizationId: ctx.activeOrgId ?? null, isPlatformSuperadmin: ctx.isPlatformSuperadmin };
  const statusParam = url.searchParams.get("status");
  const searchRaw = url.searchParams.get("search")?.trim();
  const result = await listEngineeringRequests(prisma, tenantCtx, {
    projectId: url.searchParams.get("projectId") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
    assignedToUserId: url.searchParams.get("assignedToUserId") ?? undefined,
    status: statusParam && ENGINEERING_STATUSES.includes(statusParam as (typeof ENGINEERING_STATUSES)[number]) ? (statusParam as (typeof ENGINEERING_STATUSES)[number]) : undefined,
    search: searchRaw && searchRaw.length > 0 ? searchRaw : undefined,
    limit: Number(url.searchParams.get("limit")) || 50,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

async function postHandler(req: Request) {
  const user = await requireActiveOrg();
  const body = await req.json();
  const parsed = createEngineeringRequestSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: user.isPlatformSuperadmin,
  };
  const data = parsed.data;
  const request = await createEngineeringRequest(prisma, tenantCtx, {
    ...data,
    targetDeliveryDate: data.targetDeliveryDate ? new Date(data.targetDeliveryDate) : undefined,
  });
  await createActivityLog({
    organizationId: user.activeOrgId ?? null,
    userId: user.userId ?? user.id,
    action: "engineering_request_created",
    entityType: "engineering_request",
    entityId: request.id,
    metadata: { requestNumber: request.requestNumber, projectId: request.projectId },
  });
  return NextResponse.json(request, { status: 201 });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

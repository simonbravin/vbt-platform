import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { listPartners, createPartner } from "@vbt/core";
import { createPartnerSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  await requirePlatformSuperadmin();
  const url = new URL(req.url);
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: true,
  };
  const result = await listPartners(prisma, tenantCtx, {
    status: url.searchParams.get("status") ?? undefined,
    partnerType: url.searchParams.get("partnerType") as "commercial_partner" | "master_partner" | undefined,
    limit: Number(url.searchParams.get("limit")) || 50,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

async function postHandler(req: Request) {
  const user = await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createPartnerSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const ctx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: true,
  };
  const partner = await createPartner(prisma, ctx, parsed.data);
  await createActivityLog({
    organizationId: user.activeOrgId ?? null,
    userId: user.userId ?? user.id,
    action: "partner_created",
    entityType: "organization",
    entityId: partner.id,
    metadata: { companyName: parsed.data.companyName },
  });
  return NextResponse.json(partner, { status: 201 });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

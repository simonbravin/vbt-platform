import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getRequiredByQuote, getVisionLatamOrganizationId, affectVisionLatamInventoryByQuote } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function postHandler(req: Request) {
  await requirePlatformSuperadmin();
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const body = await req.json().catch(() => ({}));
  const quoteId = typeof body.quoteId === "string" ? body.quoteId.trim() : "";
  if (!quoteId) return NextResponse.json({ error: "quoteId is required" }, { status: 400 });

  const vlOrgId = await getVisionLatamOrganizationId(prisma);
  if (!vlOrgId) return NextResponse.json({ error: "Vision Latam organization not found" }, { status: 400 });

  let warehouseId = typeof body.warehouseId === "string" ? body.warehouseId.trim() : null;
  if (!warehouseId) {
    const first = await prisma.warehouse.findFirst({
      where: { organizationId: vlOrgId, isActive: true },
      select: { id: true },
    });
    if (!first) return NextResponse.json({ error: "No warehouse found for Vision Latam" }, { status: 400 });
    warehouseId = first.id;
  } else {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: vlOrgId },
    });
    if (!wh) return NextResponse.json({ error: "Warehouse not found or does not belong to Vision Latam" }, { status: 400 });
  }

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: true,
  };
  try {
    const result = await affectVisionLatamInventoryByQuote(prisma, tenantCtx, quoteId, {
      warehouseId,
      organizationId: vlOrgId,
      createdByUserId: ctx.userId,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to affect inventory";
    if (message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw e;
  }
}

export const POST = withSaaSHandler({ rateLimitTier: "create_update" }, postHandler);

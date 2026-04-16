import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { createTransaction, listTransactions } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const organizationId = url.searchParams.get("organizationId") || undefined;
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const result = await listTransactions(prisma, tenantCtx, {
    warehouseId,
    organizationId,
    limit: limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 50)) : undefined,
    offset: offset ? Math.max(0, parseInt(offset, 10) || 0) : undefined,
  });
  return NextResponse.json(result);
}

async function postHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const body = await req.json().catch(() => ({}));
  const warehouseId = typeof body.warehouseId === "string" ? body.warehouseId.trim() : "";
  const catalogPieceId = typeof body.catalogPieceId === "string" ? body.catalogPieceId.trim() : "";
  const quantityDelta = typeof body.quantityDelta === "number" ? body.quantityDelta : Number(body.quantityDelta);
  const type = body.type as string | undefined;
  const validTypes = ["purchase_in", "sale_out", "project_consumption", "project_surplus", "adjustment_in", "adjustment_out", "transfer_in", "transfer_out"];
  if (!warehouseId || !catalogPieceId || typeof quantityDelta !== "number" || !type || !validTypes.includes(type)) {
    return NextResponse.json(
      { error: "warehouseId, catalogPieceId, quantityDelta, and type are required; type must be one of: " + validTypes.join(", ") },
      { status: 400 }
    );
  }
  let organizationId: string;
  if (ctx.isPlatformSuperadmin && body.organizationId) {
    organizationId = body.organizationId;
  } else if (ctx.activeOrgId) {
    organizationId = ctx.activeOrgId;
  } else {
    return NextResponse.json({ error: "No organization context" }, { status: 400 });
  }

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const lengthMmRaw = body.lengthMm;
  const lengthMm =
    lengthMmRaw === undefined || lengthMmRaw === null || lengthMmRaw === ""
      ? undefined
      : typeof lengthMmRaw === "number"
        ? lengthMmRaw
        : Number(lengthMmRaw);
  try {
    const transactions = await createTransaction(prisma, tenantCtx, {
      warehouseId,
      catalogPieceId,
      quantityDelta,
      type: type as "purchase_in" | "sale_out" | "project_consumption" | "project_surplus" | "adjustment_in" | "adjustment_out" | "transfer_in" | "transfer_out",
      ...(lengthMm !== undefined && Number.isFinite(lengthMm) ? { lengthMm: Math.round(lengthMm) } : {}),
      referenceQuoteId: body.referenceQuoteId ?? null,
      referenceProjectId: body.referenceProjectId ?? null,
      notes: body.notes ?? null,
      createdByUserId: ctx.userId,
      organizationId,
    });
    return NextResponse.json(transactions.length === 1 ? transactions[0] : transactions, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create transaction";
    if (message.includes("not found") || message.includes("another organization") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw e;
  }
}

export const GET = withSaaSHandler({ rateLimitTier: "read", module: "inventory" }, getHandler);
export const POST = withSaaSHandler({ rateLimitTier: "create_update", module: "inventory" }, postHandler);

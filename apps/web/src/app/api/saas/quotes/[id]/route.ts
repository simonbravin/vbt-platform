import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getQuoteById, updateQuote } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const quoteItemSchema = z.object({
  itemType: z.enum(["product", "service", "other"]),
  sku: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  quantity: z.number().min(0).optional(),
  unitCost: z.number().optional(),
  markupPct: z.number().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  sortOrder: z.number().optional(),
  catalogPieceId: z.string().nullable().optional(),
});

const patchSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).optional(),
  superadminComment: z.string().nullable().optional(),
  currency: z.string().optional(),
  factoryCostTotal: z.number().optional(),
  visionLatamMarkupPct: z.number().optional(),
  partnerMarkupPct: z.number().optional(),
  logisticsCost: z.number().optional(),
  importCost: z.number().optional(),
  localTransportCost: z.number().optional(),
  technicalServiceCost: z.number().optional(),
  totalPrice: z.number().optional(),
  validUntil: z.union([z.string(), z.null()]).optional(),
  items: z.array(quoteItemSchema).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin,
    };
    const quote = await getQuoteById(prisma, tenantCtx, params.id);
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!ctx.isPlatformSuperadmin) {
      const factory = Number(quote.factoryCostTotal ?? 0);
      const pct = Number(quote.visionLatamMarkupPct ?? 0);
      const payload = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
      payload.factoryCostTotal = null;
      payload.factoryCostUsd = null;
      payload.basePriceForPartner = factory * (1 + pct / 100);
      return NextResponse.json(payload);
    }
    return NextResponse.json(quote);
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
    const user = await requireActiveOrg();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin,
    };
    const data = parsed.data;
    const isSuperadmin = !!user.isPlatformSuperadmin;
    const commentTrim = (data.superadminComment ?? "").trim();
    const isReject = data.status === "rejected";
    const isModify =
      isSuperadmin &&
      (data.items !== undefined ||
        data.totalPrice != null ||
        data.factoryCostTotal != null ||
        data.visionLatamMarkupPct != null);

    if (isSuperadmin && (isReject || isModify) && !commentTrim) {
      return NextResponse.json(
        { error: "A comment is required when rejecting or modifying a quote." },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData: Parameters<typeof updateQuote>[3] = {
      status: data.status,
      currency: data.currency,
      ...(isSuperadmin && data.factoryCostTotal != null && { factoryCostTotal: data.factoryCostTotal }),
      ...(isSuperadmin && data.visionLatamMarkupPct != null && { visionLatamMarkupPct: data.visionLatamMarkupPct }),
      partnerMarkupPct: data.partnerMarkupPct,
      logisticsCost: data.logisticsCost,
      importCost: data.importCost,
      localTransportCost: data.localTransportCost,
      technicalServiceCost: data.technicalServiceCost,
      totalPrice: data.totalPrice,
      validUntil:
        data.validUntil === undefined
          ? undefined
          : data.validUntil == null
            ? null
            : new Date(data.validUntil as string),
      items: data.items?.map((it, i) => ({
        itemType: it.itemType,
        sku: it.sku ?? null,
        description: it.description ?? null,
        unit: it.unit ?? null,
        quantity: it.quantity ?? 0,
        unitCost: it.unitCost ?? 0,
        markupPct: it.markupPct ?? 0,
        unitPrice: it.unitPrice ?? 0,
        totalPrice: it.totalPrice ?? 0,
        sortOrder: it.sortOrder ?? i,
        catalogPieceId: it.catalogPieceId ?? null,
      })),
      ...(isSuperadmin && data.superadminComment !== undefined && {
        superadminComment: data.superadminComment,
        reviewedAt: now,
      }),
      ...(isSuperadmin && data.status === "accepted" && { approvedByUserId: user.userId ?? user.id }),
    };

    if (isModify) {
      updateData.status = "sent";
      updateData.approvedByUserId = null;
      updateData.reviewedAt = null;
    }
    const quote = await updateQuote(prisma, tenantCtx, params.id, updateData);
    const quoteOrgId = (quote as { organizationId?: string }).organizationId;
    const quoteNumber = (quote as { quoteNumber?: string }).quoteNumber;
    const metadataBase = { quoteNumber, organizationId: quoteOrgId, comment: data.superadminComment ?? undefined };
    if (data.status === "accepted") {
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "quote_approved",
        entityType: "quote",
        entityId: params.id,
        metadata: metadataBase,
      });
    } else if (data.status === "rejected") {
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "quote_rejected",
        entityType: "quote",
        entityId: params.id,
        metadata: metadataBase,
      });
    } else if (isSuperadmin && (data.superadminComment !== undefined || data.factoryCostTotal != null || data.visionLatamMarkupPct != null || data.totalPrice != null || data.items !== undefined)) {
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "quote_modified_by_superadmin",
        entityType: "quote",
        entityId: params.id,
        metadata: metadataBase,
      });
    }
    // Partners must not see factory cost in PATCH response
    if (!isSuperadmin) {
      const factory = Number((quote as { factoryCostTotal?: number }).factoryCostTotal ?? 0);
      const pct = Number((quote as { visionLatamMarkupPct?: number }).visionLatamMarkupPct ?? 0);
      const payload = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
      payload.factoryCostTotal = null;
      payload.factoryCostUsd = null;
      payload.basePriceForPartner = factory * (1 + pct / 100);
      return NextResponse.json(payload);
    }
    return NextResponse.json(quote);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

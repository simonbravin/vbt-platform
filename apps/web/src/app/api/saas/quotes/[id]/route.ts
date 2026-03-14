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
  quantity: z.number().optional(),
  unitCost: z.number().optional(),
  markupPct: z.number().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  sortOrder: z.number().optional(),
});

const patchSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).optional(),
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
      const platformRow = await prisma.platformConfig.findFirst({ select: { configJson: true } });
      const raw = (platformRow?.configJson as { pricing?: { visionLatamCommissionPct?: number } })?.pricing;
      const commissionPct = raw?.visionLatamCommissionPct ?? 20;
      const factory = Number(quote.factoryCostTotal ?? 0);
      const payload = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
      payload.factoryCostTotal = null;
      payload.factoryCostUsd = null;
      payload.basePriceForPartner = factory * (1 + commissionPct / 100);
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
    const updateData: Parameters<typeof updateQuote>[3] = {
      status: data.status,
      currency: data.currency,
      factoryCostTotal: data.factoryCostTotal,
      visionLatamMarkupPct: data.visionLatamMarkupPct,
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
      })),
    };
    const quote = await updateQuote(prisma, tenantCtx, params.id, updateData);
    if (data.status === "accepted") {
      await createActivityLog({
        organizationId: user.activeOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "quote_accepted",
        entityType: "quote",
        entityId: params.id,
        metadata: { quoteNumber: (quote as { quoteNumber?: string }).quoteNumber },
      });
    }
    return NextResponse.json(quote);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

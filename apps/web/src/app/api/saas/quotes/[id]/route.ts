/**
 * Canonical SaaS quote API by id (`getTenantContext`, `@vbt/core` services).
 * Legacy partner route: `/api/quotes/[id]`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  getTenantContext,
  requireActiveOrg,
  TenantError,
  tenantErrorStatus,
} from "@/lib/tenant";
import {
  canonicalizeSaaSQuotePayload,
  clampPartnerMarkupOnMergedSaaSSource,
  deleteQuote,
  formatQuoteForSaaSApiWithSnapshot,
  getQuoteById,
  mergeSaaSQuotePatchIntoSource,
  normalizeQuoteStatus,
  patchRequiresSaaSQuotePricingRecompute,
  QuoteMissingTaxSnapshotError,
  QuoteTaxResolutionError,
  resolvePartnerPricingConfig,
  resolveTaxRulesForSaaSQuote,
  updateQuote,
} from "@vbt/core";
import { quoteStatusEnum } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";
import { canDeleteQuote, canManageQuotes } from "@/lib/permissions";
import type { Prisma } from "@vbt/db";
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

const patchSchema = z
  .object({
    status: quoteStatusEnum.optional(),
    superadminComment: z.string().nullable().optional(),
    currency: z.string().optional(),
    factoryCostTotal: z.number().optional(),
    visionLatamMarkupPct: z.number().optional(),
    partnerMarkupPct: z.number().optional(),
    logisticsCost: z.number().optional(),
    importCost: z.number().optional(),
    localTransportCost: z.number().optional(),
    technicalServiceCost: z.number().optional(),
    validUntil: z.union([z.string(), z.null()]).optional(),
    notes: z.string().max(32_000).nullable().optional(),
    items: z.array(quoteItemSchema).optional(),
  })
  .strict()
  .refine((d) => !(d.items && d.items.length > 0 && d.factoryCostTotal !== undefined), {
    message: "Do not send factoryCostTotal when items are present; EXW is derived from lines.",
    path: ["factoryCostTotal"],
  });

type PatchBody = z.infer<typeof patchSchema>;

function patchHasEffect(data: PatchBody, isSuperadmin: boolean): boolean {
  if (data.items !== undefined) return true;
  if (data.status !== undefined) return true;
  if (data.currency !== undefined) return true;
  if (data.partnerMarkupPct !== undefined) return true;
  if (data.logisticsCost !== undefined) return true;
  if (data.importCost !== undefined) return true;
  if (data.localTransportCost !== undefined) return true;
  if (data.technicalServiceCost !== undefined) return true;
  if (data.validUntil !== undefined) return true;
  if (data.superadminComment !== undefined) return true;
  if (data.notes !== undefined) return true;
  if (isSuperadmin && data.factoryCostTotal !== undefined) return true;
  if (isSuperadmin && data.visionLatamMarkupPct !== undefined) return true;
  return false;
}

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
    return NextResponse.json(
      formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: !ctx.isPlatformSuperadmin })
    );
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof QuoteMissingTaxSnapshotError) {
      return NextResponse.json(
        { error: e.message, code: e.code, quoteId: e.quoteId },
        { status: 422 }
      );
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
    if (!canManageQuotes(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === "object" && body !== null && "status" in body && body.status != null) {
      const st = (body as { status: unknown }).status;
      if (typeof st === "string" && st.trim() !== "") {
        const n = normalizeQuoteStatus(st);
        if (n == null) {
          return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        (body as { status: string }).status = n;
      }
    }
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

    if (!patchHasEffect(data, isSuperadmin)) {
      const ctxRead = await getTenantContext();
      if (!ctxRead) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const tenantRead = {
        userId: ctxRead.userId,
        organizationId: ctxRead.activeOrgId ?? null,
        isPlatformSuperadmin: ctxRead.isPlatformSuperadmin,
      };
      const unchanged = await getQuoteById(prisma, tenantRead, params.id);
      if (!unchanged) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!isSuperadmin) {
        return NextResponse.json(formatQuoteForSaaSApiWithSnapshot(unchanged, { maskFactoryExw: true }));
      }
      return NextResponse.json(formatQuoteForSaaSApiWithSnapshot(unchanged, { maskFactoryExw: false }));
    }

    const commentTrim = (data.superadminComment ?? "").trim();
    const isReject = data.status === "rejected";
    const isModify =
      isSuperadmin &&
      (data.items !== undefined || data.factoryCostTotal != null || data.visionLatamMarkupPct != null);

    if (isSuperadmin && (isReject || isModify) && !commentTrim) {
      return NextResponse.json(
        { error: "A comment is required when rejecting or modifying a quote." },
        { status: 400 }
      );
    }

    if (!isSuperadmin && data.factoryCostTotal !== undefined) {
      return NextResponse.json({ error: "Only platform superadmin may set factoryCostTotal." }, { status: 403 });
    }
    if (!isSuperadmin && data.visionLatamMarkupPct !== undefined) {
      return NextResponse.json({ error: "Only platform superadmin may set visionLatamMarkupPct." }, { status: 403 });
    }

    const now = new Date();
    const needsPricing = patchRequiresSaaSQuotePricingRecompute(data, isSuperadmin);

    let updateData: Parameters<typeof updateQuote>[3];

    if (needsPricing) {
      const existingFull = await getQuoteById(prisma, tenantCtx, params.id);
      if (!existingFull) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const patchForMerge = {
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
        factoryCostTotal: data.factoryCostTotal,
        visionLatamMarkupPct: data.visionLatamMarkupPct,
        partnerMarkupPct: data.partnerMarkupPct,
        logisticsCost: data.logisticsCost,
        importCost: data.importCost,
        localTransportCost: data.localTransportCost,
        technicalServiceCost: data.technicalServiceCost,
      };

      const merged = mergeSaaSQuotePatchIntoSource(
        existingFull as unknown as Parameters<typeof mergeSaaSQuotePatchIntoSource>[0],
        patchForMerge,
        isSuperadmin
      );
      const fullRow = existingFull as unknown as {
        organizationId: string;
        project?: { countryCode: string | null } | null;
      };
      let taxRules;
      try {
        taxRules = await resolveTaxRulesForSaaSQuote(prisma, {
          organizationId: fullRow.organizationId,
          projectCountryCode: fullRow.project?.countryCode,
        });
      } catch (e) {
        if (e instanceof QuoteTaxResolutionError) {
          return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
        }
        throw e;
      }
      const resolved = await resolvePartnerPricingConfig(prisma, {
        organizationId: fullRow.organizationId,
        projectCountryCode: fullRow.project?.countryCode,
      });
      const mergedGuarded = clampPartnerMarkupOnMergedSaaSSource(merged, resolved);
      const canon = canonicalizeSaaSQuotePayload({ ...mergedGuarded, taxRules });

      updateData = {
        status: data.status,
        currency: data.currency,
        factoryCostTotal: canon.factoryCostTotal,
        totalPrice: canon.totalPrice,
        visionLatamMarkupPct: canon.visionLatamMarkupPct,
        partnerMarkupPct: canon.partnerMarkupPct,
        logisticsCost: canon.logisticsCostUsd,
        importCost: canon.importCostUsd,
        localTransportCost: canon.localTransportCostUsd,
        technicalServiceCost: canon.technicalServiceUsd,
        taxRulesSnapshotJson: taxRules as unknown as Prisma.InputJsonValue,
        validUntil:
          data.validUntil === undefined
            ? undefined
            : data.validUntil == null
              ? null
              : new Date(data.validUntil as string),
        items: canon.items,
        ...(isSuperadmin && data.superadminComment !== undefined && {
          superadminComment: data.superadminComment,
          reviewedAt: now,
        }),
        ...(isSuperadmin && data.status === "accepted" && { approvedByUserId: user.userId ?? user.id }),
        ...(data.notes !== undefined && { notes: data.notes }),
      };
    } else {
      updateData = {
        status: data.status,
        currency: data.currency,
        validUntil:
          data.validUntil === undefined
            ? undefined
            : data.validUntil == null
              ? null
              : new Date(data.validUntil as string),
        ...(isSuperadmin && data.superadminComment !== undefined && {
          superadminComment: data.superadminComment,
          reviewedAt: now,
        }),
        ...(isSuperadmin && data.status === "accepted" && { approvedByUserId: user.userId ?? user.id }),
        ...(data.notes !== undefined && { notes: data.notes }),
      };
    }

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
      if (isSuperadmin) {
        await createActivityLog({
          organizationId: user.activeOrgId ?? quoteOrgId ?? null,
          userId: user.userId ?? user.id,
          action: "quote_rejected",
          entityType: "quote",
          entityId: params.id,
          metadata: metadataBase,
        });
      } else {
        await createActivityLog({
          organizationId: user.activeOrgId ?? quoteOrgId ?? null,
          userId: user.userId ?? user.id,
          action: "QUOTE_UPDATED",
          entityType: "Quote",
          entityId: params.id,
          metadata: { changed: ["status"] },
        });
      }
    } else if (data.status === "archived") {
      const changedKeys = (Object.keys(data) as (keyof PatchBody)[]).filter((k) => data[k] !== undefined);
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "QUOTE_ARCHIVED",
        entityType: "Quote",
        entityId: params.id,
        metadata: { changed: changedKeys.map(String) },
      });
    } else if (
      isSuperadmin &&
      (data.superadminComment !== undefined ||
        data.factoryCostTotal != null ||
        data.visionLatamMarkupPct != null ||
        data.items !== undefined)
    ) {
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "quote_modified_by_superadmin",
        entityType: "quote",
        entityId: params.id,
        metadata: metadataBase,
      });
    } else if (!isSuperadmin && patchHasEffect(data, isSuperadmin)) {
      const changedKeys = (Object.keys(data) as (keyof PatchBody)[]).filter(
        (k) => data[k] !== undefined
      );
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "QUOTE_UPDATED",
        entityType: "Quote",
        entityId: params.id,
        metadata: { changed: changedKeys.map(String) },
      });
    }
    return NextResponse.json(formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: !isSuperadmin }));
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof QuoteMissingTaxSnapshotError) {
      return NextResponse.json(
        { error: e.message, code: e.code, quoteId: e.quoteId },
        { status: 422 }
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canDeleteQuote(sessionUser)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ctx.isPlatformSuperadmin && !ctx.activeOrgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin,
    };

    let existing;
    try {
      existing = await deleteQuote(prisma, tenantCtx, params.id);
    } catch (err) {
      if (err instanceof Error && err.message === "Quote not found") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      throw err;
    }

    await createActivityLog({
      organizationId: ctx.activeOrgId ?? existing.organizationId ?? null,
      userId: sessionUser.userId ?? sessionUser.id,
      action: "QUOTE_DELETED",
      entityType: "Quote",
      entityId: params.id,
      metadata: { quoteNumber: existing.quoteNumber },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

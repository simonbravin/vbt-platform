/**
 * Canonical SaaS quote API by id (`getTenantContext`, `@vbt/core` services).
 * Legacy partner route: `/api/quotes/[id]`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getTenantContext,
  isImpersonatingPartner,
  requireActiveOrg,
  requireSession,
  shouldMaskFactoryExw,
  TenantError,
} from "@/lib/tenant";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";
import {
  canonicalizeSaaSQuotePayload,
  clampPartnerMarkupOnMergedSaaSSource,
  deleteQuote,
  formatQuoteForSaaSApiWithSnapshot,
  getQuoteById,
  mergeSaaSQuotePatchIntoSource,
  normalizeQuoteStatus,
  patchRequiresSaaSQuotePricingRecompute,
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

type RouteCtx = { params: Promise<{ id: string }> | { id: string } };

async function quoteIdFromCtx(routeContext: unknown): Promise<string> {
  const p = (routeContext as RouteCtx).params;
  return (p instanceof Promise ? await p : p).id;
}

async function getQuoteHandler(_req: Request, routeContext: unknown) {
  const id = await quoteIdFromCtx(routeContext);
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const quote = await getQuoteById(prisma, tenantCtx, id);
  if (!quote) throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Quote not found");
  return NextResponse.json(
    formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: shouldMaskFactoryExw(ctx) })
  );
}

async function patchHandler(req: Request, routeContext: unknown) {
  const id = await quoteIdFromCtx(routeContext);
  const user = await requireActiveOrg();
  if (!canManageQuotes(user)) {
    throw new TenantError("Forbidden", "FORBIDDEN");
  }
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === "object" && body !== null && "status" in body && body.status != null) {
      const st = (body as { status: unknown }).status;
      if (typeof st === "string" && st.trim() !== "") {
        const n = normalizeQuoteStatus(st);
        if (n == null) {
          throw new ApiHttpError(400, "QUOTE_STATUS_INVALID", "Invalid quote status");
        }
        (body as { status: string }).status = n;
      }
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Validation failed", parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || undefined,
        message: issue.message,
      })));
    }
    const ctx = await getTenantContext();
    if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
    const isSuperadmin = !!user.isPlatformSuperadmin && !isImpersonatingPartner(ctx);
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: ctx.activeOrgId ?? user.activeOrgId ?? null,
      isPlatformSuperadmin: isSuperadmin,
    };
    const data = parsed.data;

    if (!patchHasEffect(data, isSuperadmin)) {
      const unchanged = await getQuoteById(prisma, tenantCtx, id);
      if (!unchanged) throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Quote not found");
      return NextResponse.json(
        formatQuoteForSaaSApiWithSnapshot(unchanged, { maskFactoryExw: shouldMaskFactoryExw(ctx) })
      );
    }

    const commentTrim = (data.superadminComment ?? "").trim();
    const isReject = data.status === "rejected";
    const isModify =
      isSuperadmin &&
      (data.items !== undefined || data.factoryCostTotal != null || data.visionLatamMarkupPct != null);

    if (isSuperadmin && (isReject || isModify) && !commentTrim) {
      throw new ApiHttpError(
        400,
        "QUOTE_SUPERADMIN_COMMENT_REQUIRED",
        "A comment is required when rejecting or modifying a quote."
      );
    }

    if (!isSuperadmin && data.factoryCostTotal !== undefined) {
      throw new ApiHttpError(403, "QUOTE_FIELD_SUPERADMIN_ONLY", "Only platform superadmin may set factoryCostTotal.");
    }
    if (!isSuperadmin && data.visionLatamMarkupPct !== undefined) {
      throw new ApiHttpError(403, "QUOTE_FIELD_SUPERADMIN_ONLY", "Only platform superadmin may set visionLatamMarkupPct.");
    }

    const now = new Date();
    const needsPricing = patchRequiresSaaSQuotePricingRecompute(data, isSuperadmin);

    let updateData: Parameters<typeof updateQuote>[3];

    if (needsPricing) {
      const existingFull = await getQuoteById(prisma, tenantCtx, id);
      if (!existingFull) throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Quote not found");

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
      const taxRules = await resolveTaxRulesForSaaSQuote(prisma, {
        organizationId: fullRow.organizationId,
        projectCountryCode: fullRow.project?.countryCode,
      });
      const resolved = await resolvePartnerPricingConfig(prisma, {
        organizationId: fullRow.organizationId,
        projectCountryCode: fullRow.project?.countryCode,
      });
      const mergedGuarded = clampPartnerMarkupOnMergedSaaSSource(merged, resolved);
      const existingNum = Number((existingFull as { numContainers?: number }).numContainers ?? 1);
      const canon = canonicalizeSaaSQuotePayload({
        ...mergedGuarded,
        taxRules,
        numContainers: Number.isFinite(existingNum) && existingNum >= 1 ? Math.floor(existingNum) : 1,
      });

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
    const quote = await updateQuote(prisma, tenantCtx, id, updateData);
    const quoteOrgId = (quote as { organizationId?: string }).organizationId;
    const quoteNumber = (quote as { quoteNumber?: string }).quoteNumber;
    const metadataBase = { quoteNumber, organizationId: quoteOrgId, comment: data.superadminComment ?? undefined };
    if (data.status === "accepted") {
      await createActivityLog({
        organizationId: user.activeOrgId ?? quoteOrgId ?? null,
        userId: user.userId ?? user.id,
        action: "quote_approved",
        entityType: "quote",
        entityId: id,
        metadata: metadataBase,
      });
    } else if (data.status === "rejected") {
      if (isSuperadmin) {
        await createActivityLog({
          organizationId: user.activeOrgId ?? quoteOrgId ?? null,
          userId: user.userId ?? user.id,
          action: "quote_rejected",
          entityType: "quote",
          entityId: id,
          metadata: metadataBase,
        });
      } else {
        await createActivityLog({
          organizationId: user.activeOrgId ?? quoteOrgId ?? null,
          userId: user.userId ?? user.id,
          action: "QUOTE_UPDATED",
          entityType: "Quote",
          entityId: id,
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
        entityId: id,
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
        entityId: id,
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
        entityId: id,
        metadata: { changed: changedKeys.map(String) },
      });
    }
    return NextResponse.json(
      formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: shouldMaskFactoryExw(ctx) })
    );
}

async function deleteQuoteHandler(_req: Request, routeContext: unknown) {
  const id = await quoteIdFromCtx(routeContext);
  const sessionUser = await requireSession();
  if (!canDeleteQuote(sessionUser)) {
    throw new TenantError("Forbidden", "FORBIDDEN");
  }

  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  if (!ctx.isPlatformSuperadmin && !ctx.activeOrgId) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };

  let existing;
  try {
    existing = await deleteQuote(prisma, tenantCtx, id);
  } catch (err) {
    if (err instanceof Error && err.message === "Quote not found") {
      throw new ApiHttpError(404, "RECORD_NOT_FOUND", "Quote not found");
    }
    throw err;
  }

  await createActivityLog({
    organizationId: ctx.activeOrgId ?? existing.organizationId ?? null,
    userId: sessionUser.userId ?? sessionUser.id,
    action: "QUOTE_DELETED",
    entityType: "Quote",
    entityId: id,
    metadata: { quoteNumber: existing.quoteNumber },
  });

  return NextResponse.json({ success: true });
}

export const GET = withSaaSHandler({ module: "quotes", rateLimitTier: "read" }, getQuoteHandler);
export const PATCH = withSaaSHandler({ module: "quotes", rateLimitTier: "create_update" }, patchHandler);
export const DELETE = withSaaSHandler({ module: "quotes", rateLimitTier: "create_update" }, deleteQuoteHandler);

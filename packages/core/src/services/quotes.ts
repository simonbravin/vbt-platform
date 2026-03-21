import type { Prisma } from "@vbt/db";
import type { PrismaClient, Quote, QuoteStatus } from "@vbt/db";
import { canonicalizeSaaSQuotePayload } from "../pricing/saas-quote-persist";
import { clampPartnerMarkupPct, resolvePartnerPricingConfig } from "../pricing/partner-pricing-resolution";
import { orgScopeWhere, type TenantContext } from "./tenant-context";
import { resolveTaxRulesForSaaSQuote } from "./quote-tax-rules";

export type QuoteItemType = "product" | "service" | "other";

export type CreateQuoteItemInput = {
  itemType: QuoteItemType;
  sku?: string | null;
  description?: string | null;
  unit?: string | null;
  quantity?: number;
  unitCost?: number;
  markupPct?: number;
  unitPrice?: number;
  totalPrice?: number;
  sortOrder?: number;
  catalogPieceId?: string | null;
};

export type ListQuotesOptions = {
  projectId?: string;
  organizationId?: string;
  status?: QuoteStatus;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listQuotes(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListQuotesOptions = {}
): Promise<{ quotes: Quote[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  const searchTrim = options.search?.trim();
  const where = {
    ...orgWhere,
    ...(options.projectId && { projectId: options.projectId }),
    ...(ctx.isPlatformSuperadmin && options.organizationId && { organizationId: options.organizationId }),
    ...(options.status && { status: options.status }),
    ...(searchTrim && {
      OR: [
        { quoteNumber: { contains: searchTrim, mode: "insensitive" as const } },
        { project: { projectName: { contains: searchTrim, mode: "insensitive" as const } } },
      ],
    }),
  };
  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        organization: { select: { name: true } },
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
            countryCode: true,
            client: { select: { name: true } },
          },
        },
        items: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ projectId: "asc" }, { version: "desc" }],
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.quote.count({ where }),
  ]);
  return { quotes, total };
}

export async function getQuoteById(
  prisma: PrismaClient,
  ctx: TenantContext,
  quoteId: string
): Promise<Quote | null> {
  const orgWhere = orgScopeWhere(ctx);
  return prisma.quote.findFirst({
    where: { id: quoteId, ...orgWhere },
    include: {
      organization: { select: { name: true } },
      project: true,
      items: { orderBy: { sortOrder: "asc" } },
      preparedByUser: { select: { id: true, fullName: true } },
      approvedByUser: { select: { id: true, fullName: true } },
    },
  });
}

export type CreateQuoteInput = {
  projectId: string;
  quoteNumber: string;
  version?: number;
  status?: QuoteStatus;
  currency?: string;
  factoryCostTotal?: number;
  visionLatamMarkupPct?: number;
  partnerMarkupPct?: number;
  logisticsCost?: number;
  importCost?: number;
  localTransportCost?: number;
  technicalServiceCost?: number;
  totalPrice?: number;
  validUntil?: Date | null;
  preparedByUserId?: string | null;
  approvedByUserId?: string | null;
  /** Partner / internal notes (persisted on Quote). */
  notes?: string | null;
  /** Optional FK to engineering_requests (same org + project). */
  engineeringRequestId?: string | null;
  items?: CreateQuoteItemInput[];
  /** Tax rules JSON snapshot at pricing write (canonical historical basis). */
  taxRulesSnapshotJson?: Prisma.InputJsonValue;
};

function toQuoteData(input: CreateQuoteInput, organizationId: string, preparedByUserId: string | null) {
  return {
    organizationId,
    projectId: input.projectId,
    quoteNumber: input.quoteNumber,
    version: input.version ?? 1,
    status: input.status ?? "draft",
    currency: input.currency ?? "USD",
    factoryCostTotal: input.factoryCostTotal ?? 0,
    visionLatamMarkupPct: input.visionLatamMarkupPct ?? 0,
    partnerMarkupPct: input.partnerMarkupPct ?? 0,
    logisticsCost: input.logisticsCost ?? 0,
    importCost: input.importCost ?? 0,
    localTransportCost: input.localTransportCost ?? 0,
    technicalServiceCost: input.technicalServiceCost ?? 0,
    totalPrice: input.totalPrice ?? 0,
    validUntil: input.validUntil ?? undefined,
    preparedByUserId: input.preparedByUserId ?? preparedByUserId,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.engineeringRequestId !== undefined ? { engineeringRequestId: input.engineeringRequestId } : {}),
    ...(input.taxRulesSnapshotJson !== undefined
      ? { taxRulesSnapshotJson: input.taxRulesSnapshotJson }
      : {}),
  };
}

export async function createQuote(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreateQuoteInput
) {
  const organizationId = ctx.organizationId ?? undefined;
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required to create quote");
  }
  const orgWhere = orgScopeWhere(ctx);
  await prisma.project.findFirstOrThrow({
    where: { id: input.projectId, ...orgWhere },
  });
  const preparedByUserId = ctx.userId ?? null;
  const items = input.items ?? [];

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: toQuoteData(input, organizationId!, preparedByUserId),
    });
    if (items.length > 0) {
      await tx.quoteItem.createMany({
        data: items.map((item, i) => ({
          quoteId: created.id,
          itemType: item.itemType,
          sku: item.sku ?? null,
          description: item.description ?? null,
          unit: item.unit ?? null,
          quantity: item.quantity ?? 0,
          unitCost: item.unitCost ?? 0,
          markupPct: item.markupPct ?? 0,
          unitPrice: item.unitPrice ?? 0,
          totalPrice: item.totalPrice ?? 0,
          sortOrder: item.sortOrder ?? i,
          catalogPieceId: item.catalogPieceId ?? null,
        })),
      });
    }
    return tx.quote.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });
  return quote!;
}

export type UpdateQuoteInput = Partial<
  Omit<CreateQuoteInput, "projectId" | "quoteNumber" | "version" | "items">
> & {
  items?: CreateQuoteItemInput[];
  superadminComment?: string | null;
  reviewedAt?: Date | null;
  approvedByUserId?: string | null;
  taxRulesSnapshotJson?: Prisma.InputJsonValue | null;
};

export async function updateQuote(
  prisma: PrismaClient,
  ctx: TenantContext,
  quoteId: string,
  data: UpdateQuoteInput
) {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.quote.findFirstOrThrow({
    where: { id: quoteId, ...orgWhere },
  });

  const items = data.items;
  const hasItems = Array.isArray(items);

  if (hasItems) {
    return prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          ...(data.status != null && { status: data.status }),
          ...(data.currency != null && { currency: data.currency }),
          ...(data.factoryCostTotal != null && { factoryCostTotal: data.factoryCostTotal }),
          ...(data.visionLatamMarkupPct != null && { visionLatamMarkupPct: data.visionLatamMarkupPct }),
          ...(data.partnerMarkupPct != null && { partnerMarkupPct: data.partnerMarkupPct }),
          ...(data.logisticsCost != null && { logisticsCost: data.logisticsCost }),
          ...(data.importCost != null && { importCost: data.importCost }),
          ...(data.localTransportCost != null && { localTransportCost: data.localTransportCost }),
          ...(data.technicalServiceCost != null && { technicalServiceCost: data.technicalServiceCost }),
          ...(data.totalPrice != null && { totalPrice: data.totalPrice }),
          ...(data.taxRulesSnapshotJson !== undefined && {
            taxRulesSnapshotJson: data.taxRulesSnapshotJson,
          }),
          ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
          ...(data.approvedByUserId !== undefined && { approvedByUserId: data.approvedByUserId }),
          ...(data.superadminComment !== undefined && { superadminComment: data.superadminComment }),
          ...(data.reviewedAt !== undefined && { reviewedAt: data.reviewedAt }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      });
      await tx.quoteItem.deleteMany({ where: { quoteId } });
      if (items!.length > 0) {
        await tx.quoteItem.createMany({
          data: items!.map((item, i) => ({
            quoteId,
            itemType: item.itemType,
            sku: item.sku ?? null,
            description: item.description ?? null,
            unit: item.unit ?? null,
            quantity: item.quantity ?? 0,
            unitCost: item.unitCost ?? 0,
            markupPct: item.markupPct ?? 0,
            unitPrice: item.unitPrice ?? 0,
            totalPrice: item.totalPrice ?? 0,
            sortOrder: item.sortOrder ?? i,
            catalogPieceId: item.catalogPieceId ?? null,
          })),
        });
      }
      return tx.quote.findUniqueOrThrow({
        where: { id: quoteId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    });
  }

  return prisma.quote.update({
    where: { id: quoteId },
    data: {
      ...(data.status != null && { status: data.status }),
      ...(data.currency != null && { currency: data.currency }),
      ...(data.factoryCostTotal != null && { factoryCostTotal: data.factoryCostTotal }),
      ...(data.visionLatamMarkupPct != null && { visionLatamMarkupPct: data.visionLatamMarkupPct }),
      ...(data.partnerMarkupPct != null && { partnerMarkupPct: data.partnerMarkupPct }),
      ...(data.logisticsCost != null && { logisticsCost: data.logisticsCost }),
      ...(data.importCost != null && { importCost: data.importCost }),
      ...(data.localTransportCost != null && { localTransportCost: data.localTransportCost }),
      ...(data.technicalServiceCost != null && { technicalServiceCost: data.technicalServiceCost }),
      ...(data.totalPrice != null && { totalPrice: data.totalPrice }),
      ...(data.taxRulesSnapshotJson !== undefined && {
        taxRulesSnapshotJson: data.taxRulesSnapshotJson,
      }),
      ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
      ...(data.approvedByUserId !== undefined && { approvedByUserId: data.approvedByUserId }),
      ...(data.superadminComment !== undefined && { superadminComment: data.superadminComment }),
      ...(data.reviewedAt !== undefined && { reviewedAt: data.reviewedAt }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export async function deleteQuote(prisma: PrismaClient, ctx: TenantContext, quoteId: string): Promise<Quote> {
  const orgWhere = orgScopeWhere(ctx);
  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, ...orgWhere },
  });
  if (!existing) {
    throw new Error("Quote not found");
  }
  await prisma.quote.delete({ where: { id: quoteId } });
  return existing;
}

export async function duplicateQuote(
  prisma: PrismaClient,
  ctx: TenantContext,
  quoteId: string
): Promise<Quote & { items: unknown[] }> {
  const orgWhere = orgScopeWhere(ctx);
  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, ...orgWhere },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      project: { select: { countryCode: true } },
    },
  });
  if (!existing) throw new Error("Quote not found");
  const nextVersion = existing.version + 1;
  const itemInputs: CreateQuoteItemInput[] = existing.items.map((it) => ({
    itemType: it.itemType as QuoteItemType,
    sku: it.sku,
    description: it.description,
    unit: it.unit,
    quantity: it.quantity,
    unitCost: it.unitCost,
    markupPct: it.markupPct,
    unitPrice: it.unitPrice,
    totalPrice: it.totalPrice,
    sortOrder: it.sortOrder,
    catalogPieceId: (it as { catalogPieceId?: string | null }).catalogPieceId ?? null,
  }));
  const taxRules = await resolveTaxRulesForSaaSQuote(prisma, {
    organizationId: existing.organizationId,
    projectCountryCode: existing.project?.countryCode,
  });
  const resolved = await resolvePartnerPricingConfig(prisma, {
    organizationId: existing.organizationId,
    projectCountryCode: existing.project?.countryCode,
  });
  const partnerMarkupPct = clampPartnerMarkupPct(
    Number(existing.partnerMarkupPct ?? 0),
    resolved.allowedPartnerMarkupMinPct,
    resolved.allowedPartnerMarkupMaxPct
  );
  const canon = canonicalizeSaaSQuotePayload({
    items: itemInputs,
    headerFactoryExwUsd: itemInputs.length > 0 ? undefined : Number(existing.factoryCostTotal ?? 0),
    visionLatamMarkupPct: Number(existing.visionLatamMarkupPct ?? 0),
    partnerMarkupPct,
    logisticsCostUsd: Number(existing.logisticsCost ?? 0),
    localTransportCostUsd: Number(existing.localTransportCost ?? 0),
    importCostUsd: Number(existing.importCost ?? 0),
    technicalServiceUsd: Number(existing.technicalServiceCost ?? 0),
    taxRules,
  });
  const existingErId = (existing as { engineeringRequestId?: string | null }).engineeringRequestId;
  const created = await createQuote(prisma, ctx, {
    projectId: existing.projectId,
    quoteNumber: existing.quoteNumber,
    version: nextVersion,
    status: "draft",
    currency: existing.currency,
    factoryCostTotal: canon.factoryCostTotal,
    visionLatamMarkupPct: canon.visionLatamMarkupPct,
    partnerMarkupPct: canon.partnerMarkupPct,
    logisticsCost: canon.logisticsCostUsd,
    importCost: canon.importCostUsd,
    localTransportCost: canon.localTransportCostUsd,
    technicalServiceCost: canon.technicalServiceUsd,
    totalPrice: canon.totalPrice,
    validUntil: existing.validUntil,
    notes: existing.notes ?? null,
    engineeringRequestId: existingErId ?? null,
    items: canon.items,
    taxRulesSnapshotJson: taxRules as unknown as Prisma.InputJsonValue,
  });
  return created as Quote & { items: unknown[] };
}

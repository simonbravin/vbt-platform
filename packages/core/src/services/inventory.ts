import type { PrismaClient } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

export type InventoryTransactionType =
  | "purchase_in"
  | "sale_out"
  | "project_consumption"
  | "project_surplus"
  | "adjustment_in"
  | "adjustment_out"
  | "transfer_in"
  | "transfer_out";

export type ListLevelsOptions = {
  warehouseId?: string;
  organizationId?: string;
  catalogPieceId?: string;
  limit?: number;
  offset?: number;
};

export type CreateTransactionInput = {
  warehouseId: string;
  catalogPieceId: string;
  quantityDelta: number;
  type: InventoryTransactionType;
  referenceQuoteId?: string | null;
  referenceProjectId?: string | null;
  notes?: string | null;
  createdByUserId?: string | null;
  organizationId: string;
};

export type ListTransactionsOptions = {
  warehouseId?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
};

/**
 * List inventory levels. Partners see only their org's warehouses; superadmin can pass organizationId to see any org.
 */
export async function listLevels(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListLevelsOptions = {}
) {
  const orgWhere = orgScopeWhere(ctx);
  const warehouseWhere: { id?: string; organizationId?: string } = {};
  if (options.warehouseId) warehouseWhere.id = options.warehouseId;
  if (ctx.isPlatformSuperadmin && options.organizationId) {
    warehouseWhere.organizationId = options.organizationId;
  } else if (orgWhere.organizationId) {
    warehouseWhere.organizationId = orgWhere.organizationId;
  } else if (!ctx.isPlatformSuperadmin) {
    return { levels: [], total: 0 };
  }

  const levelWhere = {
    ...(options.catalogPieceId && { catalogPieceId: options.catalogPieceId }),
    warehouse: warehouseWhere,
  };

  const [levels, total] = await Promise.all([
    prisma.inventoryLevel.findMany({
      where: levelWhere,
      include: {
        warehouse: { select: { id: true, name: true, organizationId: true } },
        catalogPiece: { select: { id: true, canonicalName: true, systemCode: true } },
      },
      orderBy: [{ warehouseId: "asc" }, { catalogPieceId: "asc" }],
      take: options.limit ?? 200,
      skip: options.offset ?? 0,
    }),
    prisma.inventoryLevel.count({ where: levelWhere }),
  ]);
  return { levels, total };
}

/**
 * Apply a single inventory transaction: insert transaction row and upsert inventory_levels.
 * Validates warehouse belongs to organizationId; for partners, organizationId must match ctx.
 */
export async function createTransaction(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreateTransactionInput
) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId },
    select: { id: true, organizationId: true },
  });
  if (!warehouse) throw new Error("Warehouse not found");
  if (warehouse.organizationId !== input.organizationId)
    throw new Error("Warehouse does not belong to organization");

  if (!ctx.isPlatformSuperadmin && ctx.organizationId !== input.organizationId)
    throw new Error("Cannot create transaction for another organization");

  const tx = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryTransaction.create({
      data: {
        warehouseId: input.warehouseId,
        catalogPieceId: input.catalogPieceId,
        quantityDelta: input.quantityDelta,
        type: input.type,
        referenceQuoteId: input.referenceQuoteId ?? undefined,
        referenceProjectId: input.referenceProjectId ?? undefined,
        notes: input.notes ?? undefined,
        createdByUserId: input.createdByUserId ?? undefined,
        organizationId: input.organizationId,
      },
    });

    const existing = await tx.inventoryLevel.findUnique({
      where: {
        warehouseId_catalogPieceId: {
          warehouseId: input.warehouseId,
          catalogPieceId: input.catalogPieceId,
        },
      },
    });

    const newQuantity = (existing?.quantity ?? 0) + input.quantityDelta;
    if (newQuantity < 0) throw new Error("Insufficient inventory");

    if (existing) {
      await tx.inventoryLevel.update({
        where: { id: existing.id },
        data: { quantity: newQuantity, updatedAt: new Date() },
      });
    } else {
      if (newQuantity === 0) {
        // no need to create a zero row unless we want to track it
      } else {
        await tx.inventoryLevel.create({
          data: {
            warehouseId: input.warehouseId,
            catalogPieceId: input.catalogPieceId,
            quantity: newQuantity,
          },
        });
      }
    }

    return created;
  });

  return tx;
}

/**
 * List transactions for audit. Partners see only their org; superadmin can filter by organizationId.
 */
export async function listTransactions(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListTransactionsOptions = {}
) {
  const orgWhere = orgScopeWhere(ctx);
  const where: { warehouseId?: string; organizationId?: string } = {};
  if (options.warehouseId) where.warehouseId = options.warehouseId;
  if (ctx.isPlatformSuperadmin && options.organizationId) {
    where.organizationId = options.organizationId;
  } else if (orgWhere.organizationId) {
    where.organizationId = orgWhere.organizationId;
  } else if (!ctx.isPlatformSuperadmin) {
    return { transactions: [], total: 0 };
  }

  const [transactions, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        catalogPiece: { select: { id: true, canonicalName: true, systemCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);
  return { transactions, total };
}

/**
 * Compute required quantities per catalog piece for a quote (from quote items with catalogPieceId).
 * Quotes built only by m² (estimation, no CSV/items) have no catalogPieceId on items, so this returns [];
 * inventory simulation and affect-by-quote apply only when the quote has items linked to catalog pieces.
 */
export async function getRequiredByQuote(
  prisma: PrismaClient,
  quoteId: string
): Promise<{ catalogPieceId: string; quantity: number }[]> {
  const items = await prisma.quoteItem.findMany({
    where: { quoteId, catalogPieceId: { not: null } },
    select: { catalogPieceId: true, quantity: true },
  });
  const byPiece = new Map<string, number>();
  for (const it of items) {
    if (it.catalogPieceId) {
      byPiece.set(it.catalogPieceId, (byPiece.get(it.catalogPieceId) ?? 0) + it.quantity);
    }
  }
  return Array.from(byPiece.entries()).map(([catalogPieceId, quantity]) => ({
    catalogPieceId,
    quantity,
  }));
}

/**
 * Compute required quantities per catalog piece for a project (from its quotes' items with catalogPieceId).
 * Uses the latest accepted or sent quote if any; otherwise sums all quote items for the project.
 */
export async function getRequiredByProject(
  prisma: PrismaClient,
  projectId: string
): Promise<{ catalogPieceId: string; quantity: number }[]> {
  const quotes = await prisma.quote.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    take: 1,
    select: { id: true },
  });
  if (quotes.length === 0) return [];
  return getRequiredByQuote(prisma, quotes[0].id);
}

/**
 * Simulation: for a quote or project, return required per piece and surplus/shortage per warehouse (or org).
 * Requires quote items with catalogPieceId; m²-only (estimation) quotes yield empty required.
 */
export async function simulateForQuote(
  prisma: PrismaClient,
  ctx: TenantContext,
  quoteId: string,
  options: { organizationIds?: string[] } = {}
): Promise<{
  required: { catalogPieceId: string; pieceName: string; systemCode: string; quantity: number }[];
  byWarehouse: { warehouseId: string; warehouseName: string; organizationId: string; organizationName: string; levels: { catalogPieceId: string; pieceName: string; systemCode: string; onHand: number; required: number; surplus: number; shortage: number }[] }[];
}> {
  const required = await getRequiredByQuote(prisma, quoteId);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId },
    select: { organizationId: true, projectId: true },
  });
  if (!quote) return { required: [], byWarehouse: [] };

  const orgIds = options.organizationIds ?? (ctx.isPlatformSuperadmin ? [quote.organizationId] : ctx.organizationId ? [ctx.organizationId] : []);
  const requiredMap = new Map(required.map((r) => [r.catalogPieceId, r.quantity]));

  const catalogPieces = await prisma.catalogPiece.findMany({
    where: { id: { in: required.map((r) => r.catalogPieceId) } },
    select: { id: true, canonicalName: true, systemCode: true },
  });
  const pieceInfo = new Map(catalogPieces.map((p) => [p.id, { name: p.canonicalName, systemCode: p.systemCode }]));

  const requiredWithNames = required.map((r) => {
    const info = pieceInfo.get(r.catalogPieceId);
    return {
      catalogPieceId: r.catalogPieceId,
      pieceName: info?.name ?? r.catalogPieceId,
      systemCode: info?.systemCode ?? "",
      quantity: r.quantity,
    };
  });

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId: { in: orgIds }, isActive: true },
    include: { organization: { select: { id: true, name: true } } },
  });

  const byWarehouse: {
    warehouseId: string;
    warehouseName: string;
    organizationId: string;
    organizationName: string;
    levels: { catalogPieceId: string; pieceName: string; systemCode: string; onHand: number; required: number; surplus: number; shortage: number }[];
  }[] = [];

  for (const wh of warehouses) {
    const levels = await prisma.inventoryLevel.findMany({
      where: { warehouseId: wh.id, catalogPieceId: { in: required.map((r) => r.catalogPieceId) } },
      include: { catalogPiece: { select: { id: true, canonicalName: true, systemCode: true } } },
    });
    const levelsWithSim = requiredWithNames.map((req) => {
      const level = levels.find((l) => l.catalogPieceId === req.catalogPieceId);
      const onHand = level?.quantity ?? 0;
      const reqQty = requiredMap.get(req.catalogPieceId) ?? 0;
      const surplus = Math.max(0, onHand - reqQty);
      const shortage = Math.max(0, reqQty - onHand);
      return {
        catalogPieceId: req.catalogPieceId,
        pieceName: req.pieceName,
        systemCode: req.systemCode,
        onHand,
        required: reqQty,
        surplus,
        shortage,
      };
    });
    byWarehouse.push({
      warehouseId: wh.id,
      warehouseName: wh.name,
      organizationId: wh.organization.id,
      organizationName: wh.organization.name,
      levels: levelsWithSim,
    });
  }

  return { required: requiredWithNames, byWarehouse };
}

export async function simulateForProject(
  prisma: PrismaClient,
  ctx: TenantContext,
  projectId: string,
  options: { organizationIds?: string[] } = {}
) {
  const quotes = await prisma.quote.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    take: 1,
    select: { id: true },
  });
  if (quotes.length === 0) return { required: [], byWarehouse: [] };
  return simulateForQuote(prisma, ctx, quotes[0].id, options);
}

/**
 * Find Vision Latam organization id (organizationType = vision_latam). Returns null if not found.
 */
export async function getVisionLatamOrganizationId(prisma: PrismaClient): Promise<string | null> {
  const org = await prisma.organization.findFirst({
    where: { organizationType: "vision_latam" },
    select: { id: true },
  });
  return org?.id ?? null;
}

/**
 * Affect Vision Latam inventory by a quote: create sale_out transactions for each required piece.
 * Caller must ensure ctx.isPlatformSuperadmin and warehouse belongs to Vision Latam.
 */
export async function affectVisionLatamInventoryByQuote(
  prisma: PrismaClient,
  ctx: TenantContext,
  quoteId: string,
  options: { warehouseId: string; organizationId: string; createdByUserId: string; notes?: string }
) {
  const required = await getRequiredByQuote(prisma, quoteId);
  if (required.length === 0) return { created: 0, message: "No catalog pieces linked to quote items" };
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId },
    select: { projectId: true },
  });
  const transactions = [];
  for (const r of required) {
    const t = await createTransaction(prisma, ctx, {
      warehouseId: options.warehouseId,
      catalogPieceId: r.catalogPieceId,
      quantityDelta: -r.quantity,
      type: "sale_out",
      referenceQuoteId: quoteId,
      referenceProjectId: quote?.projectId ?? null,
      notes: options.notes ?? `Affected by quote ${quoteId}`,
      createdByUserId: options.createdByUserId,
      organizationId: options.organizationId,
    });
    transactions.push(t);
  }
  return { created: transactions.length, transactions };
}

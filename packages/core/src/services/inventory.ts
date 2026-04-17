import { Prisma, type PrismaClient } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

/** `pg_advisory_xact_lock(key1, key2)` namespace — serializes inventory mutations per warehouse. */
const ADV_LOCK_INV_KEY1 = 884_291_424;

type TxWithExecuteRaw = Pick<PrismaClient, "$executeRaw">;

type InventoryDbTx = Pick<
  PrismaClient,
  "inventoryLevel" | "inventoryTransaction"
> &
  TxWithExecuteRaw;

type CreatedInventoryTx = Awaited<ReturnType<PrismaClient["inventoryTransaction"]["create"]>>;

function normalizeLengthMm(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function bulkBucketKey(catalogPieceId: string, lengthMm: number): string {
  return `${catalogPieceId}\u0001${lengthMm}`;
}

/** Prefer non-zero length buckets before legacy 0; then longer pieces first (arbitrary but stable). */
function sortLevelsForConsumption<T extends { lengthMm: number; quantity: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const za = a.lengthMm === 0 ? 1 : 0;
    const zb = b.lengthMm === 0 ? 1 : 0;
    if (za !== zb) return za - zb;
    return b.lengthMm - a.lengthMm;
  });
}

/**
 * Blocks until exclusive access to this warehouse's inventory levels for the current DB transaction.
 * Prevents lost updates when bulk import and manual (or concurrent) transactions overlap.
 */
async function acquireWarehouseInventoryXactLock(tx: TxWithExecuteRaw, warehouseId: string): Promise<void> {
  // PostgreSQL only defines pg_advisory_xact_lock(int, int) and pg_advisory_xact_lock(bigint) — not (bigint, int).
  // Prisma may bind large JS numbers as int8; cast both args to int4 explicitly.
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${ADV_LOCK_INV_KEY1}::integer, hashtext(${warehouseId}::text)::integer)`
  );
}

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
  /**
   * Inventory bucket (mm). For **ins** and non-out movements, defaults to 0 (undifferentiated).
   * For **outs** (`sale_out`, etc.): omit to consume across length buckets (non-zero first, then 0);
   * set to a number (including 0) to hit a single bucket only.
   */
  lengthMm?: number;
  referenceQuoteId?: string | null;
  referenceProjectId?: string | null;
  notes?: string | null;
  createdByUserId?: string | null;
  organizationId: string;
};

/** True when the movement removes stock (delta should be negative for a positive file count). */
export function isInventoryMovementOut(type: InventoryTransactionType): boolean {
  return (
    type === "sale_out" ||
    type === "project_consumption" ||
    type === "adjustment_out" ||
    type === "transfer_out"
  );
}

export type BulkInventoryLine = {
  catalogPieceId: string;
  /** Positive quantity from the file (same sign convention as manual “quantity” for ins). */
  quantity: number;
  /** Schedule length / height in mm; 0 = undifferentiated bucket. */
  lengthMm?: number;
};

export type CreateBulkTransactionsInput = {
  warehouseId: string;
  organizationId: string;
  type: InventoryTransactionType;
  lines: BulkInventoryLine[];
  notes?: string | null;
  createdByUserId?: string | null;
  referenceQuoteId?: string | null;
  referenceProjectId?: string | null;
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
    quantity: { gt: 0 },
    lengthMm: { not: { equals: 0 } },
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
      orderBy: [{ warehouseId: "asc" }, { catalogPieceId: "asc" }, { lengthMm: "asc" }],
      take: options.limit ?? 200,
      skip: options.offset ?? 0,
    }),
    prisma.inventoryLevel.count({ where: levelWhere }),
  ]);
  return { levels, total };
}

/**
 * Deletes inventory_level rows for warehouses in scope when:
 * - quantity is 0 or negative, or
 * - lengthMm is 0 (legacy undifferentiated bucket; removes rows even if quantity > 0).
 * Superadmin must pass `organizationId` when ctx.organizationId is null.
 */
export async function pruneZeroInventoryLevels(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: { organizationId?: string } = {}
): Promise<{ deleted: number }> {
  const warehouseWhere: { organizationId: string } = { organizationId: "" };
  if (ctx.isPlatformSuperadmin) {
    const oid = options.organizationId ?? ctx.organizationId;
    if (!oid) throw new Error("organizationId is required to prune inventory levels");
    warehouseWhere.organizationId = oid;
  } else {
    if (!ctx.organizationId) return { deleted: 0 };
    warehouseWhere.organizationId = ctx.organizationId;
  }

  const result = await prisma.inventoryLevel.deleteMany({
    where: {
      warehouse: warehouseWhere,
      OR: [{ quantity: { lte: 0 } }, { lengthMm: 0 }],
    },
  });
  return { deleted: result.count };
}

async function upsertLevelQuantity(
  tx: InventoryDbTx,
  params: {
    warehouseId: string;
    catalogPieceId: string;
    lengthMm: number;
    delta: number;
  }
): Promise<void> {
  const existing = await tx.inventoryLevel.findUnique({
    where: {
      warehouseId_catalogPieceId_lengthMm: {
        warehouseId: params.warehouseId,
        catalogPieceId: params.catalogPieceId,
        lengthMm: params.lengthMm,
      },
    },
  });
  const newQuantity = (existing?.quantity ?? 0) + params.delta;
  if (newQuantity < 0) throw new Error("Insufficient inventory");
  const isEmptyBucket = newQuantity === 0 || (Number.isFinite(newQuantity) && Math.abs(newQuantity) < 1e-9);
  if (existing) {
    if (isEmptyBucket) {
      await tx.inventoryLevel.delete({ where: { id: existing.id } });
    } else {
      await tx.inventoryLevel.update({
        where: { id: existing.id },
        data: { quantity: newQuantity, updatedAt: new Date() },
      });
    }
  } else if (!isEmptyBucket) {
    await tx.inventoryLevel.create({
      data: {
        warehouseId: params.warehouseId,
        catalogPieceId: params.catalogPieceId,
        lengthMm: params.lengthMm,
        quantity: newQuantity,
      },
    });
  }
}

/**
 * Apply inventory movement: one or more transaction rows and matching inventory_levels buckets.
 * Out movements with `lengthMm` omitted consume stock across length buckets (see `CreateTransactionInput`).
 */
export async function createTransaction(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreateTransactionInput
): Promise<CreatedInventoryTx[]> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId },
    select: { id: true, organizationId: true },
  });
  if (!warehouse) throw new Error("Warehouse not found");
  if (warehouse.organizationId !== input.organizationId)
    throw new Error("Warehouse does not belong to organization");

  if (!ctx.isPlatformSuperadmin && ctx.organizationId !== input.organizationId)
    throw new Error("Cannot create transaction for another organization");

  const movementOut = isInventoryMovementOut(input.type);
  const spreadOut = movementOut && input.quantityDelta < 0 && input.lengthMm === undefined;

  return prisma.$transaction(
    async (tx) => {
      await acquireWarehouseInventoryXactLock(tx, input.warehouseId);

      const baseTxData = {
        warehouseId: input.warehouseId,
        catalogPieceId: input.catalogPieceId,
        type: input.type,
        referenceQuoteId: input.referenceQuoteId ?? undefined,
        referenceProjectId: input.referenceProjectId ?? undefined,
        notes: input.notes ?? undefined,
        createdByUserId: input.createdByUserId ?? undefined,
        organizationId: input.organizationId,
      };

      if (spreadOut) {
        const toRemove = -input.quantityDelta;
        if (!(toRemove > 0) || !Number.isFinite(toRemove)) throw new Error("Invalid quantity for out movement");

        const rows = await tx.inventoryLevel.findMany({
          where: {
            warehouseId: input.warehouseId,
            catalogPieceId: input.catalogPieceId,
            quantity: { gt: 0 },
          },
          select: { id: true, lengthMm: true, quantity: true },
        });
        const ordered = sortLevelsForConsumption(rows);
        let remaining = toRemove;
        const created: CreatedInventoryTx[] = [];

        for (const row of ordered) {
          if (remaining <= 0) break;
          const take = Math.min(row.quantity, remaining);
          if (take <= 0) continue;

          const invTx = await tx.inventoryTransaction.create({
            data: {
              ...baseTxData,
              lengthMm: row.lengthMm,
              quantityDelta: -take,
            },
          });
          created.push(invTx);

          await upsertLevelQuantity(tx, {
            warehouseId: input.warehouseId,
            catalogPieceId: input.catalogPieceId,
            lengthMm: row.lengthMm,
            delta: -take,
          });
          remaining -= take;
        }

        if (remaining > 0) throw new Error("Insufficient inventory");
        return created;
      }

      const lengthMm = normalizeLengthMm(input.lengthMm ?? 0);

      const invTx = await tx.inventoryTransaction.create({
        data: {
          ...baseTxData,
          lengthMm,
          quantityDelta: input.quantityDelta,
        },
      });

      await upsertLevelQuantity(tx, {
        warehouseId: input.warehouseId,
        catalogPieceId: input.catalogPieceId,
        lengthMm,
        delta: input.quantityDelta,
      });

      return [invTx];
    },
    { timeout: 135_000 }
  );
}

/**
 * Apply one inventory transaction per catalog piece **and length bucket**, after merging file lines.
 * Uses a per-warehouse transaction lock and re-reads levels before validating (all-or-nothing).
 */
export async function createBulkTransactions(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreateBulkTransactionsInput
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

  const merged = new Map<string, { catalogPieceId: string; lengthMm: number; quantity: number }>();
  for (const line of input.lines) {
    if (!line.catalogPieceId || !(line.quantity > 0) || !Number.isFinite(line.quantity)) continue;
    const lengthMm = normalizeLengthMm(line.lengthMm);
    const key = bulkBucketKey(line.catalogPieceId, lengthMm);
    const prev = merged.get(key);
    if (prev) prev.quantity += line.quantity;
    else merged.set(key, { catalogPieceId: line.catalogPieceId, lengthMm, quantity: line.quantity });
  }
  if (merged.size === 0) throw new Error("No lines to apply");

  const sign = isInventoryMovementOut(input.type) ? -1 : 1;
  const pieceIds = [...new Set([...merged.values()].map((v) => v.catalogPieceId))];

  const pieces = await prisma.catalogPiece.findMany({
    where: { id: { in: pieceIds } },
    select: { id: true, canonicalName: true },
  });
  const pieceName = new Map(pieces.map((p) => [p.id, p.canonicalName]));

  const txTimeoutMs = Math.min(120_000, 10_000 + merged.size * 250);

  await prisma.$transaction(
    async (tx) => {
      await acquireWarehouseInventoryXactLock(tx, input.warehouseId);

      const levelsNow = await tx.inventoryLevel.findMany({
        where: { warehouseId: input.warehouseId, catalogPieceId: { in: pieceIds } },
        select: { id: true, catalogPieceId: true, lengthMm: true, quantity: true },
      });
      const levelQty = new Map(levelsNow.map((l) => [bulkBucketKey(l.catalogPieceId, l.lengthMm), l.quantity]));

      for (const { catalogPieceId, lengthMm, quantity } of merged.values()) {
        const delta = sign * quantity;
        const current = levelQty.get(bulkBucketKey(catalogPieceId, lengthMm)) ?? 0;
        const newQty = current + delta;
        if (newQty < 0) {
          const label = pieceName.get(catalogPieceId) ?? catalogPieceId;
          const lenNote = lengthMm === 0 ? "" : ` @ ${lengthMm} mm`;
          throw new Error(`Insufficient inventory for ${label}${lenNote}`);
        }
      }

      for (const { catalogPieceId, lengthMm, quantity } of merged.values()) {
        const delta = sign * quantity;
        if (delta === 0) continue;

        await tx.inventoryTransaction.create({
          data: {
            warehouseId: input.warehouseId,
            catalogPieceId,
            lengthMm,
            quantityDelta: delta,
            type: input.type,
            referenceQuoteId: input.referenceQuoteId ?? undefined,
            referenceProjectId: input.referenceProjectId ?? undefined,
            notes: input.notes ?? undefined,
            createdByUserId: input.createdByUserId ?? undefined,
            organizationId: input.organizationId,
          },
        });

        await upsertLevelQuantity(tx, {
          warehouseId: input.warehouseId,
          catalogPieceId,
          lengthMm,
          delta,
        });
      }
    },
    { timeout: txTimeoutMs }
  );

  return { appliedPieces: merged.size };
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
      where: {
        warehouseId: wh.id,
        catalogPieceId: { in: required.map((r) => r.catalogPieceId) },
        quantity: { gt: 0 },
        lengthMm: { not: { equals: 0 } },
      },
      include: { catalogPiece: { select: { id: true, canonicalName: true, systemCode: true } } },
    });
    const onHandByPiece = new Map<string, number>();
    for (const l of levels) {
      onHandByPiece.set(l.catalogPieceId, (onHandByPiece.get(l.catalogPieceId) ?? 0) + l.quantity);
    }
    const levelsWithSim = requiredWithNames.map((req) => {
      const onHand = onHandByPiece.get(req.catalogPieceId) ?? 0;
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
  const transactions: CreatedInventoryTx[] = [];
  for (const r of required) {
    const batch = await createTransaction(prisma, ctx, {
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
    transactions.push(...batch);
  }
  return { created: transactions.length, transactions };
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const warehouseId = url.searchParams.get("warehouseId") ?? "";

  let entityIdsInWarehouse: string[] | null = null;
  if (warehouseId) {
    const items = await prisma.inventoryItem.findMany({
      where: { warehouse: { orgId: user.orgId }, warehouseId },
      select: { id: true },
    });
    entityIdsInWarehouse = items.map((i) => i.id);
  }

  const where = {
    orgId: user.orgId,
    action: "INV_MOVE" as const,
    entityType: "InventoryItem",
    ...(entityIdsInWarehouse && entityIdsInWarehouse.length > 0
      ? { entityId: { in: entityIdsInWarehouse } }
      : entityIdsInWarehouse && entityIdsInWarehouse.length === 0
        ? { entityId: { in: [] } }
        : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const entityIds = [...new Set((logs.map((l) => l.entityId).filter(Boolean) as string[]))];
  const items =
    entityIds.length > 0
      ? await prisma.inventoryItem.findMany({
          where: { id: { in: entityIds } },
          select: {
            id: true,
            piece: { select: { canonicalName: true } },
            warehouse: { select: { name: true } },
          },
        })
      : [];
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

  return NextResponse.json({
    logs: logs.map((l) => {
      const item = l.entityId ? itemMap[l.entityId] : null;
      const meta = (l.meta as { type?: string; qty?: number; notes?: string }) ?? {};
      return {
        id: l.id,
        action: l.action,
        entityId: l.entityId,
        meta: l.meta,
        createdAt: l.createdAt,
        userName: l.user?.name ?? null,
        pieceName: item?.piece?.canonicalName ?? null,
        warehouseName: item?.warehouse?.name ?? null,
        changeLabel: formatInvMoveLabel(meta),
      };
    }),
    total,
    page,
    limit,
  });
}

function formatInvMoveLabel(meta: { type?: string; qty?: number; notes?: string }): string {
  const type = meta?.type ?? "—";
  const qty = meta?.qty ?? 0;
  const notes = meta?.notes?.trim();
  const qtyStr = type === "IN" && qty > 0 ? `+${qty}` : String(qty);
  const part = `${type} ${qtyStr} u`;
  return notes ? `${part} – ${notes}` : part;
}

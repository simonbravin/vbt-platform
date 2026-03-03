import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const moveSchema = z.object({
  type: z.enum(["IN", "OUT", "TRANSFER", "ADJUST", "RESERVE", "RELEASE"]),
  qty: z.number().positive(),
  notes: z.string().optional(),
  toWarehouseId: z.string().optional(),
  setQtyOnHand: z.number().min(0).optional(), // for ADJUST
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { type, qty, notes, toWarehouseId, setQtyOnHand } = parsed.data;

  const item = await prisma.inventoryItem.findUnique({
    where: { id: params.id },
    include: { warehouse: true },
  });
  if (!item) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });

  // Create move record
  await prisma.inventoryMove.create({
    data: {
      itemId: params.id,
      type,
      qty,
      notes,
      performedBy: user.id,
      fromWarehouseId: item.warehouseId,
      toWarehouseId,
    },
  });

  // Update quantities based on move type
  let updateData: any = {};
  switch (type) {
    case "IN":
      updateData.qtyOnHand = { increment: qty };
      updateData.qtyAvailable = { increment: qty };
      break;
    case "OUT":
      updateData.qtyOnHand = { decrement: qty };
      updateData.qtyAvailable = { decrement: qty };
      break;
    case "RESERVE":
      updateData.qtyReserved = { increment: qty };
      updateData.qtyAvailable = { decrement: qty };
      break;
    case "RELEASE":
      updateData.qtyReserved = { decrement: qty };
      updateData.qtyAvailable = { increment: qty };
      break;
    case "ADJUST":
      if (setQtyOnHand !== undefined) {
        updateData.qtyOnHand = setQtyOnHand;
        updateData.qtyAvailable = setQtyOnHand - item.qtyReserved;
      }
      break;
    case "TRANSFER":
      // Decrease from source
      updateData.qtyOnHand = { decrement: qty };
      updateData.qtyAvailable = { decrement: qty };
      // Increase at destination (handled separately)
      if (toWarehouseId) {
        const destItem = await prisma.inventoryItem.findFirst({
          where: { warehouseId: toWarehouseId, pieceId: item.pieceId },
        });
        if (destItem) {
          await prisma.inventoryItem.update({
            where: { id: destItem.id },
            data: { qtyOnHand: { increment: qty }, qtyAvailable: { increment: qty } },
          });
        }
      }
      break;
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: params.id },
    data: updateData,
  });

  await createAuditLog({
    orgId: user.orgId ?? item.warehouse.orgId,
    userId: user.id,
    action: "INV_MOVE",
    entityType: "InventoryItem",
    entityId: params.id,
    meta: { type, qty, notes },
  });

  return NextResponse.json(updated);
}

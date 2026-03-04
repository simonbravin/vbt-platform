import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: {
      project: true,
      country: true,
      lines: { orderBy: { lineNum: "asc" } },
      taxLines: { orderBy: { order: "asc" } },
      docs: { orderBy: { generatedAt: "desc" } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (status && ["DRAFT", "SENT", "ARCHIVED", "CANCELLED"].includes(status)) {
    await prisma.quote.update({
      where: { id: params.id },
      data: { status: status as any },
    });
    if (status === "ARCHIVED") {
      await createAuditLog({
        orgId: user.orgId,
        userId: user.id,
        action: "QUOTE_ARCHIVED",
        entityType: "Quote",
        entityId: params.id,
      });
    }
    const updated = await prisma.quote.findFirst({
      where: { id: params.id },
      include: { project: true, country: true, lines: true, taxLines: true },
    });
    return NextResponse.json(updated);
  }
  return NextResponse.json(quote);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  // Release any reserved inventory
  if (quote.reserveStock) {
    const reserves = await prisma.inventoryMove.findMany({
      where: { quoteId: params.id, type: "RESERVE" },
    });

    for (const res of reserves) {
      await prisma.inventoryMove.create({
        data: {
          itemId: res.itemId,
          type: "RELEASE",
          qty: res.qty,
          quoteId: params.id,
          performedBy: user.id,
          notes: `Released from cancelled quote ${quote.quoteNumber}`,
        },
      });

      await prisma.inventoryItem.update({
        where: { id: res.itemId },
        data: {
          qtyReserved: { decrement: res.qty },
          qtyAvailable: { increment: res.qty },
        },
      });
    }
  }

  await prisma.quote.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  warehouseId: z.string().min(1),
  pieceId: z.string().min(1),
  heightMm: z.number().optional(),
  qtyOnHand: z.number().min(0).default(0),
  minStockAlert: z.number().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId") ?? "";

  const items = await prisma.inventoryItem.findMany({
    where: {
      warehouse: { orgId: user.orgId },
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: {
      warehouse: true,
      piece: true,
    },
    orderBy: [{ warehouse: { name: "asc" } }, { piece: { canonicalName: "asc" } }],
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const item = await prisma.inventoryItem.create({
    data: {
      ...parsed.data,
      qtyAvailable: parsed.data.qtyOnHand,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

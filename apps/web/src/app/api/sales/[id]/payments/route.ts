import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saleOrganizationIdIfReadable, salesUserCanMutate } from "@/lib/sales-access";
import { SaleOrderStatus } from "@vbt/db";
import { z } from "zod";
import { refreshSaleComputedStatus } from "@/lib/partner-sales";

const postSchema = z.object({
  entityId: z.string().min(1),
  amountUsd: z.number().positive(),
  amountLocal: z.number().optional(),
  currencyLocal: z.string().optional(),
  exchangeRate: z.number().optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: saleId } = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, saleId);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sale = await prisma.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sale.status === SaleOrderStatus.CANCELLED) {
    return NextResponse.json({ error: "Cannot add payment to cancelled sale" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  const ent = await prisma.billingEntity.findFirst({
    where: { id: data.entityId, organizationId, isActive: true },
  });
  if (!ent) return NextResponse.json({ error: "Invalid billing entity" }, { status: 400 });

  await prisma.payment.create({
    data: {
      organizationId,
      saleId,
      billingEntityId: data.entityId,
      amountUsd: data.amountUsd,
      amountLocal: data.amountLocal ?? null,
      currencyLocal: data.currencyLocal ?? null,
      exchangeRate: data.exchangeRate ?? null,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      notes: data.notes ?? null,
      createdByUserId: user.id ?? null,
    },
  });

  if (sale.status === SaleOrderStatus.DRAFT) {
    await prisma.sale.update({
      where: { id: saleId },
      data: { status: SaleOrderStatus.CONFIRMED },
    });
  }

  await refreshSaleComputedStatus(saleId);
  return NextResponse.json({ ok: true });
}

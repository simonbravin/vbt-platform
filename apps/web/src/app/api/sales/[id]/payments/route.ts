import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { getInvoicedAmount, computeSaleStatus } from "@/lib/sales";
import { z } from "zod";

const createSchema = z.object({
  entityId: z.string().min(1),
  amountUsd: z.number().min(0.01),
  amountLocal: z.number().optional().nullable(),
  currencyLocal: z.string().optional().nullable(),
  exchangeRate: z.number().optional().nullable(),
  paidAt: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; id: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const saleId = params.id;

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, orgId: user.orgId },
    select: { id: true, status: true, exwUsd: true, fobUsd: true, cifUsd: true, landedDdpUsd: true, invoicedBasis: true },
  });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  if (sale.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot add payment to a cancelled sale" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const entity = await prisma.billingEntity.findFirst({
    where: { id: data.entityId, orgId: user.orgId },
  });
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 400 });

  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

  const payment = await prisma.payment.create({
    data: {
      orgId: user.orgId,
      saleId,
      entityId: data.entityId,
      amountUsd: data.amountUsd,
      amountLocal: data.amountLocal ?? undefined,
      currencyLocal: data.currencyLocal ?? undefined,
      exchangeRate: data.exchangeRate ?? undefined,
      paidAt,
      notes: data.notes ?? undefined,
      createdBy: user.id,
    },
    include: {
      entity: { select: { id: true, name: true, slug: true } },
    },
  });

  const payments = await prisma.payment.findMany({
    where: { saleId },
    select: { amountUsd: true, entityId: true },
  });
  const totalPaid = payments.reduce((a, p) => a + p.amountUsd, 0);
  const overdueCount = await prisma.saleInvoice.count({
    where: { saleId, dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
  });
  const hasOverdueInvoice = overdueCount > 0;
  const newStatus = computeSaleStatus(sale!.status, sale!, totalPaid, hasOverdueInvoice);
  await prisma.sale.update({
    where: { id: saleId },
    data: { status: newStatus },
  });
  if (sale!.status !== newStatus) {
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "SALE_STATUS_RECALCULATED" as any,
      entityType: "Sale",
      entityId: saleId,
      meta: { previousStatus: sale!.status, newStatus },
    });
  }

  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "PAYMENT_RECORDED" as any,
    entityType: "Payment",
    entityId: payment.id,
    meta: { saleId, amountUsd: data.amountUsd, entityId: data.entityId },
  });

  return NextResponse.json(payment);
}

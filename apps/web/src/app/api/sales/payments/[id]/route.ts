import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { getInvoicedAmount, computeSaleStatus } from "@/lib/sales";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; role: string; id?: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const paymentId = params.id;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orgId: user.orgId },
    select: { id: true, saleId: true, amountUsd: true, entityId: true },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const sale = await prisma.sale.findFirst({
    where: { id: payment.saleId, orgId: user.orgId },
    select: { id: true, status: true, exwUsd: true, fobUsd: true, cifUsd: true, landedDdpUsd: true, invoicedBasis: true },
  });
  const previousStatus = sale?.status;

  await prisma.payment.delete({ where: { id: paymentId } });

  const payments = await prisma.payment.findMany({
    where: { saleId: payment.saleId },
    select: { amountUsd: true },
  });
  const totalPaid = payments.reduce((a, p) => a + p.amountUsd, 0);
  const overdueCount = sale
    ? await prisma.saleInvoice.count({
        where: { saleId: payment.saleId, dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
      })
    : 0;
  const hasOverdueInvoice = overdueCount > 0;
  const newStatus = sale
    ? computeSaleStatus(sale.status, sale, totalPaid, hasOverdueInvoice)
    : previousStatus ?? "CONFIRMED";
  await prisma.sale.update({
    where: { id: payment.saleId },
    data: { status: newStatus },
  });
  if (previousStatus !== newStatus && sale && user.orgId) {
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "SALE_STATUS_RECALCULATED" as any,
      entityType: "Sale",
      entityId: payment.saleId,
      meta: { previousStatus, newStatus },
    });
  }

  return new NextResponse(null, { status: 204 });
}

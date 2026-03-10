import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInvoicedAmount, computeSaleStatus, roundMoney } from "@/lib/sales";
import { z } from "zod";

const updateSchema = z
  .object({
    entityId: z.string().min(1).optional(),
    amountUsd: z.number().min(0).optional(),
    dueDate: z.string().optional().nullable(),
    sequence: z.number().int().min(1).optional(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: saleId, invoiceId } = await params;

  const existing = await prisma.saleInvoice.findFirst({
    where: { id: invoiceId, saleId },
    include: { sale: true },
  });
  if (!existing || existing.sale.orgId !== user.orgId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (existing.sale.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot edit invoices of a cancelled sale" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.amountUsd != null) {
    const otherInvoices = await prisma.saleInvoice.findMany({
      where: { saleId, id: { not: invoiceId } },
      select: { amountUsd: true },
    });
    const otherSum = otherInvoices.reduce((a, i) => a + i.amountUsd, 0);
    const maxInvoiced = roundMoney(getInvoicedAmount(existing.sale));
    if (roundMoney(otherSum + parsed.data.amountUsd) > maxInvoiced) {
      return NextResponse.json(
        {
          error: `Sum of invoice amounts would exceed invoiced amount for this sale (max ${maxInvoiced.toFixed(2)} USD).`,
        },
        { status: 400 }
      );
    }
  }

  if (parsed.data.entityId != null) {
    const entity = await prisma.billingEntity.findFirst({
      where: { id: parsed.data.entityId, orgId: user.orgId },
    });
    if (!entity) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.entityId != null) updateData.entityId = parsed.data.entityId;
  if (parsed.data.amountUsd != null) updateData.amountUsd = roundMoney(parsed.data.amountUsd);
  if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.sequence != null) updateData.sequence = parsed.data.sequence;
  if (parsed.data.referenceNumber !== undefined) updateData.referenceNumber = parsed.data.referenceNumber ?? null;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ?? null;

  const invoice = await prisma.saleInvoice.update({
    where: { id: invoiceId },
    data: updateData,
    include: { entity: { select: { id: true, name: true, slug: true } } },
  });

  // Recalc sale status after invoice change (e.g. due date)
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, orgId: user.orgId },
    include: { invoices: true },
  });
  if (sale) {
    const payments = await prisma.payment.findMany({ where: { saleId }, select: { amountUsd: true } });
    const totalPaid = payments.reduce((a, p) => a + p.amountUsd, 0);
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const hasOverdueInvoice = sale.invoices.some((i) => i.dueDate && new Date(i.dueDate) < todayStart);
    const newStatus = computeSaleStatus(sale.status, sale, totalPaid, hasOverdueInvoice);
    if (newStatus !== sale.status) {
      await prisma.sale.update({ where: { id: saleId }, data: { status: newStatus } });
    }
  }

  return NextResponse.json(invoice);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: saleId, invoiceId } = await params;

  const existing = await prisma.saleInvoice.findFirst({
    where: { id: invoiceId, saleId },
    include: { sale: true },
  });
  if (!existing || existing.sale.orgId !== user.orgId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (existing.sale.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot delete invoices of a cancelled sale" }, { status: 400 });
  }

  await prisma.saleInvoice.delete({ where: { id: invoiceId } });

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, orgId: user.orgId },
    include: { invoices: true },
  });
  if (sale) {
    const payments = await prisma.payment.findMany({ where: { saleId }, select: { amountUsd: true } });
    const totalPaid = payments.reduce((a, p) => a + p.amountUsd, 0);
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const hasOverdueInvoice = sale.invoices.some((i) => i.dueDate && new Date(i.dueDate) < todayStart);
    const newStatus = computeSaleStatus(sale.status, sale, totalPaid, hasOverdueInvoice);
    if (newStatus !== sale.status) {
      await prisma.sale.update({ where: { id: saleId }, data: { status: newStatus } });
    }
  }

  return NextResponse.json({ success: true });
}

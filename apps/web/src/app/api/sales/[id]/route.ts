import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { getInvoicedAmount, computeSaleStatus } from "@/lib/sales";
import { z } from "zod";

const saleStatusEnum = z.enum(["DRAFT", "CONFIRMED", "PARTIALLY_PAID", "PAID", "DUE", "CANCELLED"]);

const invoiceSchema = z.object({
  id: z.string().optional(),
  entityId: z.string(),
  amountUsd: z.number().min(0),
  dueDate: z.string().optional().nullable(),
  sequence: z.number().int().min(1).optional().default(1),
  notes: z.string().optional().nullable(),
});

const updateSchema = z.object({
  status: saleStatusEnum.optional(),
  exwUsd: z.number().min(0).optional(),
  commissionPct: z.number().min(0).optional(),
  commissionAmountUsd: z.number().min(0).optional(),
  fobUsd: z.number().min(0).optional(),
  freightUsd: z.number().min(0).optional(),
  cifUsd: z.number().min(0).optional(),
  taxesFeesUsd: z.number().min(0).optional(),
  landedDdpUsd: z.number().min(0).optional(),
  invoicedBasis: z.enum(["EXW", "FOB", "CIF", "DDP"]).optional().nullable(),
  taxBreakdownJson: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  invoices: z.array(invoiceSchema).optional(),
}).partial();

function computeInvoiceStatus(
  invoices: { amountUsd: number; entityId: string }[],
  payments: { amountUsd: number; entityId: string }[]
): Record<string, { paid: number; invoiced: number; status: string }> {
  const byEntity: Record<string, { paid: number; invoiced: number }> = {};
  for (const inv of invoices) {
    byEntity[inv.entityId] = byEntity[inv.entityId] ?? { paid: 0, invoiced: 0 };
    byEntity[inv.entityId].invoiced += inv.amountUsd;
  }
  for (const p of payments) {
    byEntity[p.entityId] = byEntity[p.entityId] ?? { paid: 0, invoiced: 0 };
    byEntity[p.entityId].paid += p.amountUsd;
  }
  const result: Record<string, { paid: number; invoiced: number; status: string }> = {};
  for (const [eid, v] of Object.entries(byEntity)) {
    result[eid] = {
      ...v,
      status: v.paid >= v.invoiced ? "PAID" : v.paid > 0 ? "PARTIAL" : "PENDING",
    };
  }
  return result;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };
  const { id } = params;

  const sale = await prisma.sale.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      client: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      invoices: { include: { entity: { select: { id: true, name: true, slug: true } } } },
      payments: { include: { entity: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  // Recalc DUE when opening: if not PAID/DRAFT/CANCELLED and has overdue invoice, set DUE
  if (sale.status !== "DRAFT" && sale.status !== "CANCELLED" && sale.status !== "PAID") {
    const totalPaid = sale.payments.reduce((a, p) => a + p.amountUsd, 0);
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const hasOverdueInvoice = sale.invoices.some((i) => i.dueDate && new Date(i.dueDate) < todayStart);
    const expectedStatus = computeSaleStatus(sale.status, sale, totalPaid, hasOverdueInvoice);
    if (expectedStatus !== sale.status) {
      await prisma.sale.update({ where: { id }, data: { status: expectedStatus } });
      (sale as { status: string }).status = expectedStatus;
    }
  }

  const invoiceStatusByEntity = computeInvoiceStatus(
    sale.invoices.map((i) => ({ amountUsd: i.amountUsd, entityId: i.entityId })),
    sale.payments.map((p) => ({ amountUsd: p.amountUsd, entityId: p.entityId }))
  );

  return NextResponse.json({
    ...sale,
    invoiceStatusByEntity,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; id: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.sale.findFirst({
    where: { id, orgId: user.orgId },
    include: { invoices: true },
  });
  if (!existing) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const updatePayload: Record<string, unknown> = {};
  if (data.status != null) updatePayload.status = data.status;
  if (data.exwUsd != null) updatePayload.exwUsd = data.exwUsd;
  if (data.commissionPct != null) updatePayload.commissionPct = data.commissionPct;
  if (data.commissionAmountUsd != null) updatePayload.commissionAmountUsd = data.commissionAmountUsd;
  if (data.fobUsd != null) updatePayload.fobUsd = data.fobUsd;
  if (data.freightUsd != null) updatePayload.freightUsd = data.freightUsd;
  if (data.cifUsd != null) updatePayload.cifUsd = data.cifUsd;
  if (data.taxesFeesUsd != null) updatePayload.taxesFeesUsd = data.taxesFeesUsd;
  if (data.landedDdpUsd != null) updatePayload.landedDdpUsd = data.landedDdpUsd;
  if (data.invoicedBasis !== undefined) updatePayload.invoicedBasis = data.invoicedBasis;
  if (data.taxBreakdownJson !== undefined) updatePayload.taxBreakdownJson = data.taxBreakdownJson;
  if (data.notes !== undefined) updatePayload.notes = data.notes;

  // Block PAID unless fully paid (round to 2 decimals to avoid floating-point edge cases)
  if (data.status === "PAID") {
    const payments = await prisma.payment.findMany({ where: { saleId: id }, select: { amountUsd: true } });
    const totalPaid = payments.reduce((a, p) => a + p.amountUsd, 0);
    const merged = { ...existing, ...updatePayload } as typeof existing;
    const invoiced = getInvoicedAmount(merged);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    if (round2(totalPaid) < round2(invoiced)) {
      return NextResponse.json(
        { error: "Cannot set status to PAID: total payments are less than invoiced amount" },
        { status: 400 }
      );
    }
  }

  const recalcStatus =
    data.invoices != null ||
    data.invoicedBasis !== undefined ||
    data.exwUsd != null ||
    data.fobUsd != null ||
    data.cifUsd != null ||
    data.landedDdpUsd != null;

  if (data.invoices != null) {
    const mergedForInv = { ...existing, ...updatePayload } as typeof existing;
    const invoicedTotal = getInvoicedAmount(mergedForInv);
    const invoicesSum = data.invoices.reduce((a, inv) => a + inv.amountUsd, 0);
    if (invoicesSum > invoicedTotal) {
      return NextResponse.json(
        { error: `Sum of invoice amounts (${invoicesSum.toFixed(2)}) cannot exceed invoiced amount for selected basis (${invoicedTotal.toFixed(2)})` },
        { status: 400 }
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.saleInvoice.deleteMany({ where: { saleId: id } });
      for (const inv of data.invoices!) {
        const entity = await tx.billingEntity.findFirst({
          where: { id: inv.entityId, orgId: user.orgId },
        });
        if (entity) {
          await tx.saleInvoice.create({
            data: {
              saleId: id,
              entityId: inv.entityId,
              amountUsd: inv.amountUsd,
              dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
              sequence: inv.sequence ?? 1,
              notes: inv.notes ?? null,
            },
          });
        }
      }
    });
  }

  if (recalcStatus) {
    const payments = await prisma.payment.findMany({ where: { saleId: id }, select: { amountUsd: true } });
    const totalPaid = payments.reduce((a, p) => a + p.amountUsd, 0);
    const overdueCount = await prisma.saleInvoice.count({
      where: { saleId: id, dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    const hasOverdueInvoice = overdueCount > 0;
    const merged = { ...existing, ...updatePayload } as typeof existing;
    // Use intended status (user-sent or existing) so CONFIRMED is not overwritten by DRAFT
    const currentStatusForCalc = data.status ?? existing.status;
    const newStatus = computeSaleStatus(currentStatusForCalc, merged, totalPaid, hasOverdueInvoice);
    const automaticStatuses = ["PAID", "PARTIALLY_PAID", "DUE"];
    if (automaticStatuses.includes(newStatus)) {
      updatePayload.status = newStatus;
    } else if (data.status != null && ["DRAFT", "CONFIRMED", "CANCELLED"].includes(data.status)) {
      updatePayload.status = data.status;
    } else {
      updatePayload.status = newStatus;
    }

    if (data.invoicedBasis !== undefined && existing.invoicedBasis !== data.invoicedBasis) {
      await createAuditLog({
        orgId: user.orgId,
        userId: user.id,
        action: "SALE_INVOICED_BASIS_CHANGED" as any,
        entityType: "Sale",
        entityId: id,
        meta: {
          oldBasis: existing.invoicedBasis,
          newBasis: data.invoicedBasis,
          previousStatus: existing.status,
          newStatus: updatePayload.status,
        },
      });
    }
    if (data.invoices != null) {
      await createAuditLog({
        orgId: user.orgId,
        userId: user.id,
        action: "SALE_INVOICE_UPDATED" as any,
        entityType: "Sale",
        entityId: id,
        meta: { invoiceCount: data.invoices.length },
      });
    }
  } else if (data.status != null && existing.status !== data.status) {
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "SALE_STATUS_CHANGED" as any,
      entityType: "Sale",
      entityId: id,
      meta: { previousStatus: existing.status, newStatus: data.status },
    });
  }

  const updated = await prisma.sale.update({
    where: { id },
    data: updatePayload as any,
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true } },
      invoices: { include: { entity: { select: { id: true, name: true, slug: true } } } },
      payments: { include: { entity: { select: { id: true, name: true, slug: true } } } },
    },
  });

  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "SALE_UPDATED" as any,
    entityType: "Sale",
    entityId: id,
    meta: { changed: Object.keys(updatePayload) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; id: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const sale = await prisma.sale.findFirst({
    where: { id, orgId: user.orgId },
    select: {
      id: true,
      saleNumber: true,
      status: true,
      clientId: true,
      projectId: true,
      _count: { select: { invoices: true, payments: true } },
    },
  });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "SALE_DELETED" as any,
    entityType: "Sale",
    entityId: id,
    meta: {
      saleNumber: sale.saleNumber,
      status: sale.status,
      clientId: sale.clientId,
      projectId: sale.projectId,
      invoiceCount: sale._count.invoices,
      paymentCount: sale._count.payments,
    },
  });

  await prisma.sale.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

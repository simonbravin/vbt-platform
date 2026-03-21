import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saleOrganizationIdIfReadable, salesUserCanMutate } from "@/lib/sales-access";
import { z } from "zod";
import { refreshSaleComputedStatus } from "@/lib/partner-sales";

const patchSchema = z.object({
  entityId: z.string().min(1),
  amountUsd: z.number().min(0),
  dueDate: z.string().optional().nullable(),
  sequence: z.number().int().min(1).optional(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; invoiceId: string }> | { id: string; invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, p.id);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sale = await prisma.sale.findFirst({
    where: { id: p.id, organizationId },
    include: { _count: { select: { payments: true } } },
  });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sale._count.payments > 0) {
    return NextResponse.json({ error: "Cannot edit invoices when payments exist" }, { status: 400 });
  }

  const inv = await prisma.saleInvoice.findFirst({
    where: { id: p.invoiceId, saleId: p.id },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  const ent = await prisma.billingEntity.findFirst({
    where: { id: data.entityId, organizationId, isActive: true },
  });
  if (!ent) return NextResponse.json({ error: "Invalid billing entity" }, { status: 400 });

  await prisma.saleInvoice.update({
    where: { id: inv.id },
    data: {
      billingEntityId: data.entityId,
      amountUsd: data.amountUsd,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      sequence: data.sequence ?? 1,
      referenceNumber: data.referenceNumber ?? null,
      notes: data.notes ?? null,
    },
  });
  await refreshSaleComputedStatus(p.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ id: string; invoiceId: string }> | { id: string; invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, p.id);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sale = await prisma.sale.findFirst({
    where: { id: p.id, organizationId },
    include: { _count: { select: { payments: true } } },
  });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sale._count.payments > 0) {
    return NextResponse.json({ error: "Cannot remove invoices when payments exist" }, { status: 400 });
  }

  const inv = await prisma.saleInvoice.findFirst({
    where: { id: p.invoiceId, saleId: p.id },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.saleInvoice.delete({ where: { id: inv.id } });
  await refreshSaleComputedStatus(p.id);
  return NextResponse.json({ ok: true });
}

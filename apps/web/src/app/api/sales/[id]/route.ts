import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saleOrganizationIdIfReadable, salesUserCanMutate } from "@/lib/sales-access";
import { SaleOrderStatus } from "@vbt/db";
import { z } from "zod";
import {
  getSaleForOrg,
  refreshSaleComputedStatus,
  serializeSaleDetail,
} from "@/lib/partner-sales";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
  exwUsd: z.number().optional(),
  commissionPct: z.number().optional(),
  commissionAmountUsd: z.number().optional(),
  fobUsd: z.number().optional(),
  freightUsd: z.number().optional(),
  cifUsd: z.number().optional(),
  taxesFeesUsd: z.number().optional(),
  landedDdpUsd: z.number().optional(),
  invoicedBasis: z.enum(["EXW", "FOB", "CIF", "DDP"]).optional(),
  notes: z.string().optional().nullable(),
  invoices: z
    .array(
      z.object({
        entityId: z.string().min(1),
        amountUsd: z.number().min(0),
        dueDate: z.string().optional().nullable(),
        sequence: z.number().int().min(1).optional(),
        referenceNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  const { id } = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, id);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sale = await getSaleForOrg(id, organizationId);
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeSaleDetail(sale));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, id);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.sale.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { payments: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const replaceInvoices =
    data.invoices !== undefined && existing._count.payments === 0;

  const statusUpdate =
    data.status === "DRAFT"
      ? SaleOrderStatus.DRAFT
      : data.status === "CONFIRMED"
        ? SaleOrderStatus.CONFIRMED
        : data.status === "CANCELLED"
          ? SaleOrderStatus.CANCELLED
          : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      if (replaceInvoices && data.invoices) {
        await tx.saleInvoice.deleteMany({ where: { saleId: id } });
        for (const inv of data.invoices) {
          const ent = await tx.billingEntity.findFirst({
            where: { id: inv.entityId, organizationId, isActive: true },
          });
          if (!ent) throw new Error("Invalid billing entity");
          await tx.saleInvoice.create({
            data: {
              saleId: id,
              billingEntityId: inv.entityId,
              amountUsd: inv.amountUsd,
              dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
              sequence: inv.sequence ?? 1,
              referenceNumber: inv.referenceNumber ?? null,
              notes: inv.notes ?? null,
            },
          });
        }
      }

      await tx.sale.update({
        where: { id },
        data: {
          ...(statusUpdate !== undefined ? { status: statusUpdate } : {}),
          ...(data.exwUsd !== undefined ? { exwUsd: data.exwUsd } : {}),
          ...(data.commissionPct !== undefined ? { commissionPct: data.commissionPct } : {}),
          ...(data.commissionAmountUsd !== undefined ? { commissionAmountUsd: data.commissionAmountUsd } : {}),
          ...(data.fobUsd !== undefined ? { fobUsd: data.fobUsd } : {}),
          ...(data.freightUsd !== undefined ? { freightUsd: data.freightUsd } : {}),
          ...(data.cifUsd !== undefined ? { cifUsd: data.cifUsd } : {}),
          ...(data.taxesFeesUsd !== undefined ? { taxesFeesUsd: data.taxesFeesUsd } : {}),
          ...(data.landedDdpUsd !== undefined ? { landedDdpUsd: data.landedDdpUsd } : {}),
          ...(data.invoicedBasis !== undefined ? { invoicedBasis: data.invoicedBasis } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });
    });

    await refreshSaleComputedStatus(id);

    if (data.status === "CONFIRMED") {
      await prisma.project.updateMany({
        where: { id: existing.projectId, organizationId, status: { not: "lost" } },
        data: { status: "won" },
      });
    }

    const sale = await getSaleForOrg(id, organizationId);
    return NextResponse.json(sale ? serializeSaleDetail(sale) : { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Invalid billing entity") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[PATCH /api/sales/[id]]", e);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params instanceof Promise ? await params : params;
  const organizationId = await saleOrganizationIdIfReadable(user, id);
  if (!organizationId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.sale.findFirst({ where: { id, organizationId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.sale.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

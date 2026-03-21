import { prisma } from "@/lib/db";
import type { Prisma } from "@vbt/db";
import { SaleOrderStatus } from "@vbt/db";
import { computeSaleStatus, getInvoicedAmount } from "@/lib/sales";

const DEFAULT_BILLING_ENTITIES = [
  { name: "Vision Profile Extrusions LTD", slug: "VISION_PROFILE_EXTRUSIONS" },
  { name: "Vision Latam SA", slug: "VISION_LATAM" },
  { name: "VBT Argentina SA", slug: "VBT_ARGENTINA" },
  { name: "VBT Panama SA", slug: "VBT_PANAMA" },
] as const;

export function salesRoleCanWrite(role: string): boolean {
  const r = (role || "").toLowerCase();
  return r === "org_admin" || r === "sales_user";
}

export async function ensureBillingEntities(organizationId: string): Promise<void> {
  for (const d of DEFAULT_BILLING_ENTITIES) {
    await prisma.billingEntity.upsert({
      where: { organizationId_slug: { organizationId, slug: d.slug } },
      create: { organizationId, name: d.name, slug: d.slug, isActive: true },
      update: { name: d.name },
    });
  }
}

export async function nextSaleNumber(tx: Prisma.TransactionClient, organizationId: string): Promise<string> {
  for (let bump = 0; bump < 20; bump++) {
    const count = await tx.sale.count({ where: { organizationId } });
    const candidate = `S-${String(count + 1 + bump).padStart(5, "0")}`;
    const clash = await tx.sale.findFirst({
      where: { organizationId, saleNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `S-${Date.now()}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function refreshSaleComputedStatus(saleId: string): Promise<void> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      invoices: true,
      payments: true,
    },
  });
  if (!sale) return;
  if (sale.status === SaleOrderStatus.DRAFT || sale.status === SaleOrderStatus.CANCELLED) return;

  const totalPaid = sale.payments.reduce((a, p) => a + p.amountUsd, 0);
  const today = startOfDay(new Date());
  const hasOverdueInvoice = sale.invoices.some((inv) => {
    if (!inv.dueDate) return false;
    return startOfDay(inv.dueDate) < today;
  });
  const next = computeSaleStatus(
    sale.status,
    {
      invoicedBasis: sale.invoicedBasis,
      exwUsd: sale.exwUsd,
      fobUsd: sale.fobUsd,
      cifUsd: sale.cifUsd,
      landedDdpUsd: sale.landedDdpUsd,
    },
    totalPaid,
    hasOverdueInvoice
  );
  if (next !== sale.status) {
    await prisma.sale.update({
      where: { id: saleId },
      data: { status: next as SaleOrderStatus },
    });
  }
}

const saleDetailInclude = {
  client: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, projectName: true } },
  quote: { select: { id: true, quoteNumber: true } },
  invoices: { include: { billingEntity: { select: { id: true, name: true, slug: true } } } },
  payments: { include: { billingEntity: { select: { id: true, name: true, slug: true } } } },
} as const;

export type SaleDetailRecord = Prisma.SaleGetPayload<{ include: typeof saleDetailInclude }>;

function invoiceStatusByEntity(sale: SaleDetailRecord): Record<string, { paid: number; invoiced: number; status: string }> {
  const by: Record<string, { paid: number; invoiced: number; status: string }> = {};
  for (const inv of sale.invoices) {
    const id = inv.billingEntityId;
    if (!by[id]) by[id] = { paid: 0, invoiced: 0, status: "" };
    by[id].invoiced += inv.amountUsd;
  }
  for (const p of sale.payments) {
    const id = p.billingEntityId;
    if (!by[id]) by[id] = { paid: 0, invoiced: 0, status: "" };
    by[id].paid += p.amountUsd;
  }
  for (const id of Object.keys(by)) {
    const row = by[id];
    const bal = row.invoiced - row.paid;
    if (bal <= 0.005) row.status = "paid";
    else if (row.paid > 0) row.status = "partial";
    else row.status = "open";
  }
  return by;
}

export function serializeSaleDetail(sale: SaleDetailRecord) {
  return {
    id: sale.id,
    organizationId: sale.organizationId,
    saleNumber: sale.saleNumber,
    clientId: sale.clientId,
    projectId: sale.projectId,
    quantity: sale.quantity,
    status: sale.status,
    invoicedBasis: sale.invoicedBasis,
    exwUsd: sale.exwUsd,
    commissionPct: sale.commissionPct,
    commissionAmountUsd: sale.commissionAmountUsd,
    fobUsd: sale.fobUsd,
    freightUsd: sale.freightUsd,
    cifUsd: sale.cifUsd,
    taxesFeesUsd: sale.taxesFeesUsd,
    landedDdpUsd: sale.landedDdpUsd,
    notes: sale.notes,
    createdAt: sale.createdAt.toISOString(),
    client: sale.client,
    project: { id: sale.project.id, name: sale.project.projectName },
    quote: sale.quote
      ? { id: sale.quote.id, quoteNumber: sale.quote.quoteNumber }
      : null,
    invoices: sale.invoices.map((inv) => ({
      id: inv.id,
      entityId: inv.billingEntityId,
      amountUsd: inv.amountUsd,
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      sequence: inv.sequence,
      referenceNumber: inv.referenceNumber,
      notes: inv.notes,
      entity: { name: inv.billingEntity.name, slug: inv.billingEntity.slug },
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      entityId: p.billingEntityId,
      amountUsd: p.amountUsd,
      amountLocal: p.amountLocal,
      currencyLocal: p.currencyLocal,
      exchangeRate: p.exchangeRate,
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
      entity: { name: p.billingEntity.name, slug: p.billingEntity.slug },
    })),
    invoiceStatusByEntity: invoiceStatusByEntity(sale),
  };
}

type SaleListRowDb = Prisma.SaleGetPayload<{
  include: {
    client: { select: { id: true; name: true } };
    project: { select: { id: true; projectName: true } };
    quote: { select: { id: true; quoteNumber: true } };
    _count: { select: { invoices: true; payments: true } };
  };
}> & { organization?: { id: string; name: string } | null };

export function serializeSaleListRow(sale: SaleListRowDb) {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    clientId: sale.clientId,
    projectId: sale.projectId,
    quantity: sale.quantity,
    status: sale.status,
    invoicedBasis: sale.invoicedBasis,
    exwUsd: sale.exwUsd,
    commissionPct: sale.commissionPct,
    commissionAmountUsd: sale.commissionAmountUsd,
    fobUsd: sale.fobUsd,
    freightUsd: sale.freightUsd,
    cifUsd: sale.cifUsd,
    taxesFeesUsd: sale.taxesFeesUsd,
    landedDdpUsd: sale.landedDdpUsd,
    createdAt: sale.createdAt.toISOString(),
    client: sale.client,
    project: { id: sale.project.id, name: sale.project.projectName },
    quote: sale.quote ? { id: sale.quote.id, quoteNumber: sale.quote.quoteNumber } : null,
    organization: sale.organization ? { id: sale.organization.id, name: sale.organization.name } : undefined,
    _count: sale._count,
  };
}

export async function getSaleForOrg(saleId: string, organizationId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, organizationId },
    include: saleDetailInclude,
  });
}

export async function buildStatementsResponse(
  organizationId: string,
  filters: { clientId?: string; entityId?: string; from?: string; to?: string }
) {
  await ensureBillingEntities(organizationId);
  const entities = await prisma.billingEntity.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const fromDate = filters.from ? new Date(filters.from + "T00:00:00.000Z") : undefined;
  const toDate = filters.to ? new Date(filters.to + "T23:59:59.999Z") : undefined;

  const sales = await prisma.sale.findMany({
    where: {
      organizationId,
      status: { not: SaleOrderStatus.CANCELLED },
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, projectName: true } },
      invoices: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  type Row = {
    id: string;
    saleNumber: string | null;
    clientId: string;
    projectId: string;
    quantity: number;
    status: string;
    invoicedBasis: string | null;
    exwUsd: number;
    fobUsd: number;
    cifUsd: number;
    landedDdpUsd: number;
    project: { id: string; name: string };
    payments: { amountUsd: number }[];
    statementInvoiced: number;
    statementPaid: number;
  };

  const byClient = new Map<string, { client: { id: string; name: string }; rows: Row[] }>();

  for (const s of sales) {
    const invSum = s.invoices
      .filter((i) => !filters.entityId || i.billingEntityId === filters.entityId)
      .reduce((a, i) => a + i.amountUsd, 0);
    const paySum = s.payments
      .filter((p) => !filters.entityId || p.billingEntityId === filters.entityId)
      .reduce((a, p) => a + p.amountUsd, 0);
    if (filters.entityId && invSum === 0 && paySum === 0) continue;

    const row: Row = {
      id: s.id,
      saleNumber: s.saleNumber,
      clientId: s.clientId,
      projectId: s.projectId,
      quantity: s.quantity,
      status: s.status,
      invoicedBasis: s.invoicedBasis,
      exwUsd: s.exwUsd,
      fobUsd: s.fobUsd,
      cifUsd: s.cifUsd,
      landedDdpUsd: s.landedDdpUsd,
      project: { id: s.project.id, name: s.project.projectName },
      payments: s.payments
        .filter((p) => !filters.entityId || p.billingEntityId === filters.entityId)
        .map((p) => ({ amountUsd: p.amountUsd })),
      statementInvoiced: invSum,
      statementPaid: paySum,
    };

    const key = s.client.id;
    if (!byClient.has(key)) {
      byClient.set(key, { client: s.client, rows: [] });
    }
    byClient.get(key)!.rows.push(row);
  }

  const statements = Array.from(byClient.values()).map(({ client, rows }) => {
    const totalInvoiced = rows.reduce((a, r) => a + r.statementInvoiced, 0);
    const totalPaid = rows.reduce((a, r) => a + r.statementPaid, 0);
    return {
      client,
      sales: rows,
      totalInvoiced,
      totalPaid,
      balance: totalInvoiced - totalPaid,
    };
  });

  return {
    statements,
    entities,
    filters: {
      clientId: filters.clientId ?? null,
      entityId: filters.entityId ?? null,
      from: filters.from ?? null,
      to: filters.to ?? null,
    },
  };
}

export async function salesSummaryForOrg(organizationId: string) {
  const sales = await prisma.sale.findMany({
    where: { organizationId, status: { not: SaleOrderStatus.CANCELLED } },
    include: { invoices: true, payments: true },
  });
  let totalValue = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;
  const byStatus: Record<string, number> = {};
  for (const s of sales) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    totalValue += getInvoicedAmount(s);
    totalInvoiced += s.invoices.reduce((a, i) => a + i.amountUsd, 0);
    totalPaid += s.payments.reduce((a, p) => a + p.amountUsd, 0);
  }
  return {
    totalSales: sales.length,
    totalValue,
    totalInvoiced,
    totalPaid,
    totalPending: totalInvoiced - totalPaid,
    byStatus,
    entitySummary: [] as { id: string; name: string; slug: string; invoiced: number; paid: number; balance: number }[],
  };
}

export async function listDueInvoiceItems(
  organizationId: string,
  daysAhead: number
): Promise<{ count: number; invoices: Array<{ id: string; saleId: string; amountUsd: number; dueDate: string; clientName: string }> }> {
  const today = startOfDay(new Date());
  const limit = new Date(today);
  limit.setDate(limit.getDate() + Math.max(1, Math.min(30, daysAhead)));

  const rows = await prisma.saleInvoice.findMany({
    where: {
      sale: { organizationId, status: { notIn: [SaleOrderStatus.CANCELLED, SaleOrderStatus.PAID] } },
      dueDate: {
        not: null,
        lte: limit,
      },
    },
    include: {
      sale: { include: { client: { select: { name: true } } } },
    },
  });

  const invoices = rows.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    amountUsd: r.amountUsd,
    dueDate: r.dueDate!.toISOString(),
    clientName: r.sale.client.name,
  }));

  return { count: invoices.length, invoices };
}

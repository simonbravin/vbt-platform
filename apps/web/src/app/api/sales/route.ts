import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  resolveOrganizationIdForSaleCreate,
  salesListWhere,
  salesUserCanMutate,
} from "@/lib/sales-access";
import type { Prisma } from "@vbt/db";
import { SaleOrderStatus } from "@vbt/db";
import { z } from "zod";
import {
  ensureBillingEntities,
  nextSaleNumber,
  refreshSaleComputedStatus,
  serializeSaleListRow,
} from "@/lib/partner-sales";

const postSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  quoteId: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  exwUsd: z.number(),
  commissionPct: z.number(),
  commissionAmountUsd: z.number(),
  fobUsd: z.number(),
  freightUsd: z.number(),
  cifUsd: z.number(),
  taxesFeesUsd: z.number(),
  landedDdpUsd: z.number(),
  invoicedBasis: z.enum(["EXW", "FOB", "CIF", "DDP"]).optional(),
  notes: z.string().optional(),
  /** Platform superadmin: create sale in this org (alternatively ?organizationId= or active-org cookie). */
  organizationId: z.string().optional(),
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

function parseStatus(s: string | null): SaleOrderStatus | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase();
  const map: Record<string, SaleOrderStatus> = {
    DRAFT: SaleOrderStatus.DRAFT,
    CONFIRMED: SaleOrderStatus.CONFIRMED,
    PARTIALLY_PAID: SaleOrderStatus.PARTIALLY_PAID,
    PAID: SaleOrderStatus.PAID,
    DUE: SaleOrderStatus.DUE,
    CANCELLED: SaleOrderStatus.CANCELLED,
  };
  return map[up];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  const url = new URL(req.url);
  const baseWhere = await salesListWhere(user, url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const statusParam = url.searchParams.get("status");
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = (url.searchParams.get("search") ?? "").trim();

  const status = parseStatus(statusParam);
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = new Date(from + "T00:00:00.000Z");
  if (to) createdAt.lte = new Date(to + "T23:59:59.999Z");

  const where: Prisma.SaleWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(from || to ? { createdAt } : {}),
  };

  if (search) {
    where.OR = [
      { saleNumber: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
      { project: { projectName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, projectName: true } },
        quote: { select: { id: true, quoteNumber: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { invoices: true, payments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    sales: rows.map(serializeSaleListRow),
    total,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  if (!salesUserCanMutate(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const url = new URL(req.url);
  const orgResolved = await resolveOrganizationIdForSaleCreate(user, url, data.organizationId);
  if (!orgResolved.ok) {
    return NextResponse.json({ error: orgResolved.error }, { status: orgResolved.status });
  }
  const organizationId = orgResolved.organizationId;
  const [client, project, quoteRow] = await Promise.all([
    prisma.client.findFirst({ where: { id: data.clientId, organizationId }, select: { id: true } }),
    prisma.project.findFirst({ where: { id: data.projectId, organizationId }, select: { id: true } }),
    data.quoteId
      ? prisma.quote.findFirst({ where: { id: data.quoteId, organizationId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
  if (data.quoteId && !quoteRow) return NextResponse.json({ error: "Quote not found" }, { status: 400 });

  await ensureBillingEntities(organizationId);

  const invoiceLines = data.invoices ?? [];
  for (const inv of invoiceLines) {
    const ent = await prisma.billingEntity.findFirst({
      where: { id: inv.entityId, organizationId, isActive: true },
    });
    if (!ent) return NextResponse.json({ error: "Invalid billing entity" }, { status: 400 });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const saleNumber = await nextSaleNumber(tx, organizationId);
      const statusEnum = data.status === "CONFIRMED" ? SaleOrderStatus.CONFIRMED : SaleOrderStatus.DRAFT;
      const created = await tx.sale.create({
        data: {
          organizationId,
          clientId: data.clientId,
          projectId: data.projectId,
          quoteId: data.quoteId ?? null,
          saleNumber,
          quantity: data.quantity,
          status: statusEnum,
          exwUsd: data.exwUsd,
          commissionPct: data.commissionPct,
          commissionAmountUsd: data.commissionAmountUsd,
          fobUsd: data.fobUsd,
          freightUsd: data.freightUsd,
          cifUsd: data.cifUsd,
          taxesFeesUsd: data.taxesFeesUsd,
          landedDdpUsd: data.landedDdpUsd,
          invoicedBasis: data.invoicedBasis ?? "DDP",
          notes: data.notes ?? null,
          createdByUserId: user.id ?? null,
          invoices:
            invoiceLines.length > 0
              ? {
                  create: invoiceLines.map((inv) => ({
                    billingEntityId: inv.entityId,
                    amountUsd: inv.amountUsd,
                    dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
                    sequence: inv.sequence ?? 1,
                    referenceNumber: inv.referenceNumber ?? null,
                    notes: inv.notes ?? null,
                  })),
                }
              : undefined,
        },
      });
      return created;
    });

    await refreshSaleComputedStatus(sale.id);

    if (data.status === "CONFIRMED") {
      await prisma.project.updateMany({
        where: { id: data.projectId, organizationId, status: { not: "lost" } },
        data: { status: "won" },
      });
    }

    return NextResponse.json({ id: sale.id });
  } catch (e) {
    console.error("[POST /api/sales]", e);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}

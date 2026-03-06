import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const saleStatusEnum = z.enum(["DRAFT", "CONFIRMED", "PARTIALLY_PAID", "PAID", "CANCELLED"]);

const invoiceSchema = z.object({
  entityId: z.string(),
  amountUsd: z.number().min(0),
  dueDate: z.string().optional(),
  sequence: z.number().int().min(1).optional().default(1),
  notes: z.string().optional(),
});

const createSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  quoteId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  status: saleStatusEnum.optional().default("DRAFT"),
  exwUsd: z.number().min(0).default(0),
  commissionPct: z.number().min(0).default(0),
  commissionAmountUsd: z.number().min(0).default(0),
  fobUsd: z.number().min(0).default(0),
  freightUsd: z.number().min(0).default(0),
  cifUsd: z.number().min(0).default(0),
  taxesFeesUsd: z.number().min(0).default(0),
  landedDdpUsd: z.number().min(0).default(0),
  taxBreakdownJson: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  invoices: z.array(invoiceSchema).optional().default([]),
});

async function getNextSaleNumber(tx: any, orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SAL-${year}-`;
  const existing = await tx.sale.findMany({
    where: { orgId, saleNumber: { startsWith: prefix } },
    select: { saleNumber: true },
    orderBy: { saleNumber: "desc" },
    take: 1,
  });
  const maxNum = existing[0]?.saleNumber
    ? parseInt(existing[0].saleNumber.replace(prefix, ""), 10) || 0
    : 0;
  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 5000);
  const status = url.searchParams.get("status") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const projectId = url.searchParams.get("projectId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const search = url.searchParams.get("search") ?? "";

  const where: Record<string, unknown> = { orgId: user.orgId };
  if (status) (where as any).status = status;
  if (clientId) (where as any).clientId = clientId;
  if (projectId) (where as any).projectId = projectId;
  if (from || to) {
    (where as any).createdAt = {};
    if (from) (where as any).createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      (where as any).createdAt.lte = d;
    }
  }
  if (search.trim()) {
    (where as any).OR = [
      { saleNumber: { contains: search.trim(), mode: "insensitive" } },
      { client: { name: { contains: search.trim(), mode: "insensitive" } } },
      { project: { name: { contains: search.trim(), mode: "insensitive" } } },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        quote: { select: { id: true, quoteNumber: true } },
        _count: { select: { invoices: true, payments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return NextResponse.json({ sales, total, page, limit });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; id: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const data = parsed.data;

    const project = await prisma.project.findFirst({
      where: { id: data.projectId, orgId: user.orgId },
      select: { id: true, clientId: true, status: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    if (project.clientId && project.clientId !== data.clientId) {
      return NextResponse.json({ error: "Project client does not match selected client" }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, orgId: user.orgId },
    });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });

    let quote: { id: string; projectId: string; orgId: string; factoryCostUsd: number; commissionPct: number; commissionFixed: number; fobUsd: number; freightCostUsd: number; cifUsd: number; taxesFeesUsd: number; landedDdpUsd: number } | null = null;
    if (data.quoteId) {
      quote = await prisma.quote.findFirst({
        where: { id: data.quoteId, orgId: user.orgId },
        select: {
          id: true,
          projectId: true,
          orgId: true,
          factoryCostUsd: true,
          commissionPct: true,
          commissionFixed: true,
          fobUsd: true,
          freightCostUsd: true,
          cifUsd: true,
          taxesFeesUsd: true,
          landedDdpUsd: true,
        },
      });
      if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 400 });
      if (quote.projectId !== data.projectId) {
        return NextResponse.json({ error: "Quote does not belong to the selected project" }, { status: 400 });
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      const saleNumber = await getNextSaleNumber(tx, user.orgId);
      const exw = data.exwUsd;
      const commPct = data.commissionPct;
      const commAmt = data.commissionAmountUsd;
      const fob = data.fobUsd;
      const freight = data.freightUsd;
      const cif = data.cifUsd;
      const taxes = data.taxesFeesUsd;
      const ddp = data.landedDdpUsd;

      const saleRow = await tx.sale.create({
        data: {
          orgId: user.orgId,
          clientId: data.clientId,
          projectId: data.projectId,
          quoteId: data.quoteId ?? null,
          saleNumber,
          quantity: data.quantity,
          status: data.status as any,
          exwUsd: exw,
          commissionPct: commPct,
          commissionAmountUsd: commAmt,
          fobUsd: fob,
          freightUsd: freight,
          cifUsd: cif,
          taxesFeesUsd: taxes,
          landedDdpUsd: ddp,
          taxBreakdownJson: data.taxBreakdownJson ?? undefined,
          notes: data.notes ?? null,
          createdBy: user.id,
        },
      });

      for (const inv of data.invoices) {
        const entity = await tx.billingEntity.findFirst({
          where: { id: inv.entityId, orgId: user.orgId },
        });
        if (entity) {
          await tx.saleInvoice.create({
            data: {
              saleId: saleRow.id,
              entityId: inv.entityId,
              amountUsd: inv.amountUsd,
              dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
              sequence: inv.sequence ?? 1,
              notes: inv.notes ?? null,
            },
          });
        }
      }

      if (data.status === "CONFIRMED") {
        await tx.project.update({
          where: { id: data.projectId },
          data: {
            status: "SOLD",
            soldAt: new Date(),
            finalAmountUsd: ddp,
          },
        });
      }

      return tx.sale.findUnique({
        where: { id: saleRow.id },
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          quote: { select: { id: true, quoteNumber: true } },
          invoices: { include: { entity: { select: { id: true, name: true, slug: true } } } },
        },
      });
    });

    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "SALE_CREATED" as any,
      entityType: "Sale",
      entityId: sale!.id,
      meta: { saleNumber: sale!.saleNumber },
    });

    return NextResponse.json(sale);
  } catch (e) {
    console.error("POST /api/sales error:", e);
    let message = e instanceof Error ? e.message : "Failed to create sale";
    if (typeof message === "string" && /does not exist|relation.*does not exist/i.test(message)) {
      message = "La tabla de ventas no existe en la base de datos. Ejecuta las migraciones (ej. prisma migrate deploy o db push) en el servidor.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSession, TenantError } from "@/lib/tenant";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";
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
import { resolveMultiProjectSaleLines } from "@/lib/sale-multi-project";
import { parseSaleListDateEnd, parseSaleListDateStart } from "@/lib/sale-list-date-filters";

const projectLineSchema = z.object({
  projectId: z.string().min(1),
  quoteId: z.string().min(1).optional(),
  containerSharePct: z.number().min(0).max(100).nullable().optional(),
});

const postSchema = z
  .object({
    clientId: z.string().min(1),
    projectId: z.string().optional(),
    projectLines: z.preprocess(
      (val) => (Array.isArray(val) && val.length === 0 ? undefined : val),
      z.array(projectLineSchema).min(1).optional()
    ),
    quoteId: z.string().optional(),
    quantity: z.number().int().min(1).default(1),
    status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
    exwUsd: z.number().optional(),
    commissionPct: z.number().optional(),
    commissionAmountUsd: z.number().optional(),
    fobUsd: z.number().optional(),
    freightUsd: z.number().optional(),
    cifUsd: z.number().optional(),
    taxesFeesUsd: z.number().optional(),
    landedDdpUsd: z.number().optional(),
    invoicedBasis: z.enum(["EXW", "FOB", "CIF", "DDP"]).optional(),
    notes: z.string().optional(),
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
  })
  .superRefine((val, ctx) => {
    const multi = (val.projectLines?.length ?? 0) > 0;
    const single = Boolean(val.projectId?.trim());
    if (multi && single) {
      ctx.addIssue({ code: "custom", message: "Send either projectId or projectLines, not both", path: ["projectLines"] });
    }
    if (!multi && !single) {
      ctx.addIssue({ code: "custom", message: "projectId or projectLines is required", path: ["projectId"] });
    }
    if (!multi) {
      const need: (keyof typeof val)[] = [
        "exwUsd",
        "commissionPct",
        "commissionAmountUsd",
        "fobUsd",
        "freightUsd",
        "cifUsd",
        "taxesFeesUsd",
        "landedDdpUsd",
      ];
      for (const k of need) {
        if (val[k] === undefined) {
          ctx.addIssue({ code: "custom", message: `${String(k)} is required`, path: [String(k)] });
        }
      }
    }
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

async function salesGetHandler(req: Request) {
  const user = (await requireSession()) as SessionUser;
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
  const gte = parseSaleListDateStart(from);
  const lte = parseSaleListDateEnd(to);
  if (gte) createdAt.gte = gte;
  if (lte) createdAt.lte = lte;
  const hasCreatedAtFilter = Boolean(createdAt.gte ?? createdAt.lte);

  const where: Prisma.SaleWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(hasCreatedAtFilter ? { createdAt } : {}),
  };

  const andExtra: Prisma.SaleWhereInput[] = [];
  if (projectId) {
    andExtra.push({
      OR: [{ projectId }, { saleProjectLines: { some: { projectId } } }],
    });
  }
  if (search) {
    andExtra.push({
      OR: [
        { saleNumber: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        { project: { projectName: { contains: search, mode: "insensitive" } } },
        {
          saleProjectLines: {
            some: { project: { projectName: { contains: search, mode: "insensitive" } } },
          },
        },
      ],
    });
  }
  if (andExtra.length) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...andExtra];
  }

  const [total, rows] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, projectName: true } },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            visionLatamMarkupPct: true,
            partnerMarkupPct: true,
            factoryCostTotal: true,
          },
        },
        saleProjectLines: {
          orderBy: { sortOrder: "asc" },
          include: { project: { select: { id: true, projectName: true } } },
        },
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

async function salesPostHandler(req: Request) {
  const user = (await requireSession()) as SessionUser;
  if (!salesUserCanMutate(user)) {
    throw new TenantError("Forbidden", "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiHttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Validation failed", parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || undefined,
      message: issue.message,
    })));
  }

  const data = parsed.data;
  const url = new URL(req.url);
  const orgResolved = await resolveOrganizationIdForSaleCreate(user, url, data.organizationId);
  if (!orgResolved.ok) {
    throw new ApiHttpError(orgResolved.status, "SALES_ORG_SCOPE_REQUIRED", orgResolved.error);
  }
  const organizationId = orgResolved.organizationId;
  const clientRow = await prisma.client.findFirst({
    where: { id: data.clientId, organizationId },
    select: { id: true },
  });
  if (!clientRow) {
    throw new ApiHttpError(400, "SALES_CLIENT_NOT_FOUND", "Client not found for this organization.");
  }

  const isMulti = (data.projectLines?.length ?? 0) > 0;

  let primaryProjectId: string;
  let headerQuoteId: string | null;
  let exwUsd: number;
  let commissionPct: number;
  let commissionAmountUsd: number;
  let fobUsd: number;
  let freightUsd: number;
  let cifUsd: number;
  let taxesFeesUsd: number;
  let landedDdpUsd: number;
  let resolvedLinesForCreate: {
    projectId: string;
    quoteId: string | null;
    containerSharePct: number | null;
    sortOrder: number;
  }[];

  if (isMulti) {
    try {
      const { financials, resolvedLines } = await resolveMultiProjectSaleLines(
        prisma,
        organizationId,
        data.clientId,
        data.projectLines!,
        data.quantity,
        !user.isPlatformSuperadmin
      );
      primaryProjectId = resolvedLines[0]!.projectId;
      headerQuoteId = resolvedLines[0]!.quoteId;
      exwUsd = financials.exwUsd;
      commissionPct = financials.commissionPct;
      commissionAmountUsd = financials.commissionAmountUsd;
      fobUsd = financials.fobUsd;
      freightUsd = financials.freightUsd;
      cifUsd = financials.cifUsd;
      taxesFeesUsd = financials.taxesFeesUsd;
      landedDdpUsd = financials.landedDdpUsd;
      resolvedLinesForCreate = resolvedLines.map((l) => ({
        projectId: l.projectId,
        quoteId: l.quoteId,
        containerSharePct: l.containerSharePct,
        sortOrder: l.sortOrder,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid multi-project sale";
      throw new ApiHttpError(400, "SALES_MULTI_PROJECT_INVALID", msg);
    }
  } else {
    const [project, quoteRow] = await Promise.all([
      prisma.project.findFirst({ where: { id: data.projectId!, organizationId }, select: { id: true } }),
      data.quoteId
        ? prisma.quote.findFirst({
            where: { id: data.quoteId, organizationId, projectId: data.projectId! },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!project) throw new ApiHttpError(400, "SALES_PROJECT_NOT_FOUND", "Project not found for this organization.");
    if (data.quoteId && !quoteRow) {
      throw new ApiHttpError(400, "SALES_QUOTE_PROJECT_MISMATCH", "Quote not found for this project.");
    }
    primaryProjectId = data.projectId!;
    headerQuoteId = data.quoteId ?? null;
    exwUsd = data.exwUsd!;
    commissionPct = data.commissionPct!;
    commissionAmountUsd = data.commissionAmountUsd!;
    fobUsd = data.fobUsd!;
    freightUsd = data.freightUsd!;
    cifUsd = data.cifUsd!;
    taxesFeesUsd = data.taxesFeesUsd!;
    landedDdpUsd = data.landedDdpUsd!;
    resolvedLinesForCreate = [
      {
        projectId: primaryProjectId,
        quoteId: headerQuoteId,
        containerSharePct: null,
        sortOrder: 0,
      },
    ];
  }

  await ensureBillingEntities(organizationId);

  const invoiceLines = data.invoices ?? [];
  if (invoiceLines.length > 0) {
    const entityIds = [...new Set(invoiceLines.map((inv) => inv.entityId))];
    const entities = await prisma.billingEntity.findMany({
      where: { id: { in: entityIds }, organizationId, isActive: true },
      select: { id: true },
    });
    if (entities.length !== entityIds.length) {
      throw new ApiHttpError(400, "SALES_INVALID_BILLING_ENTITY", "Invalid or inactive billing entity.");
    }
  }

  const sale = await prisma.$transaction(async (tx) => {
    const saleNumber = await nextSaleNumber(tx, organizationId);
    const statusEnum = data.status === "CONFIRMED" ? SaleOrderStatus.CONFIRMED : SaleOrderStatus.DRAFT;
    const created = await tx.sale.create({
      data: {
        organizationId,
        clientId: data.clientId,
        projectId: primaryProjectId,
        quoteId: headerQuoteId,
        saleNumber,
        quantity: data.quantity,
        status: statusEnum,
        exwUsd,
        commissionPct,
        commissionAmountUsd,
        fobUsd,
        freightUsd,
        cifUsd,
        taxesFeesUsd,
        landedDdpUsd,
        invoicedBasis: data.invoicedBasis ?? "DDP",
        notes: data.notes ?? null,
        createdByUserId: user.id ?? null,
        saleProjectLines: {
          create: resolvedLinesForCreate.map((l) => ({
            projectId: l.projectId,
            quoteId: l.quoteId,
            containerSharePct: l.containerSharePct,
            sortOrder: l.sortOrder,
          })),
        },
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
    const projectIds = [...new Set(resolvedLinesForCreate.map((l) => l.projectId))];
    await prisma.project.updateMany({
      where: { id: { in: projectIds }, organizationId, status: { not: "lost" } },
      data: { status: "won" },
    });
  }

  return NextResponse.json({ id: sale.id });
}

export const GET = withSaaSHandler({ module: "sales", rateLimitTier: "read" }, salesGetHandler);
export const POST = withSaaSHandler({ module: "sales", rateLimitTier: "create_update" }, salesPostHandler);

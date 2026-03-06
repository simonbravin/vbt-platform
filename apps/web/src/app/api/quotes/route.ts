import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { buildQuoteSnapshot, TaxRule, removeVersionPrefix } from "@vbt/core";
import { generateQuoteNumber } from "@/lib/utils";

const createSchema = z.object({
  projectId: z.string().min(1),
  costMethod: z.enum(["CSV", "M2_BY_SYSTEM", "M2_TOTAL"]),
  baseUom: z.enum(["M", "FT"]).default("M"),
  revitImportId: z.string().optional(),
  warehouseId: z.string().optional(),
  reserveStock: z.boolean().default(false),
  m2S80: z.number().min(0).default(0),
  m2S150: z.number().min(0).default(0),
  m2S200: z.number().min(0).default(0),
  m2Total: z.number().min(0).default(0),
  commissionPct: z.number().min(0).default(0),
  commissionFixed: z.number().min(0).default(0),
  commissionFixedPerKit: z.number().min(0).default(0),
  freightCostUsd: z.number().min(0).default(0),
  freightProfileId: z.string().optional(),
  numContainers: z.number().min(1).default(1),
  kitsPerContainer: z.number().min(0).default(0),
  totalKits: z.number().min(0).default(0),
  countryId: z.string().optional(),
  taxRuleSetId: z.string().optional(),
  notes: z.string().optional(),
  factoryCostUsd: z.number().min(0).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const projectId = url.searchParams.get("projectId") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim();

  const where: any = {
    orgId: user.orgId,
    ...(status ? { status: status as any } : {}),
    ...(projectId ? { projectId } : {}),
  };

  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" } },
      { project: { name: { contains: search, mode: "insensitive" } } },
      { project: { client: { contains: search, mode: "insensitive" } } },
      { project: { location: { contains: search, mode: "insensitive" } } },
      { country: { name: { contains: search, mode: "insensitive" } } },
      { country: { code: { contains: search, mode: "insensitive" } } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      project: { select: { name: true, client: true, location: true } },
      country: { select: { name: true, code: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(quotes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // Get org defaults
  const org = await prisma.org.findUnique({ where: { id: user.orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // Load CSV lines if CSV method
  let csvImportLines: any[] = [];
  let pieceMeta: Record<string, any> = {};

  if (data.costMethod === "CSV" && data.revitImportId) {
    const importData = await prisma.revitImport.findFirst({
      where: { id: data.revitImportId, orgId: user.orgId },
      include: {
        lines: {
          include: {
            piece: {
              include: {
                costs: { orderBy: { effectiveFrom: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (importData) {
      csvImportLines = importData.lines
        .filter((l) => !l.isIgnored)
        .map((l) => {
          const rawPieceCost = (l as any).piece?.costs?.[0]?.pricePerMCored;
          const pieceCost = rawPieceCost != null ? Number(rawPieceCost) : undefined;
          const rawPricePerM = l.pricePerM;
          const pricePerM = rawPricePerM != null ? Number(rawPricePerM) : undefined;
          return {
            description: removeVersionPrefix(l.rawPieceName),
            pieceId: l.pieceId ?? undefined,
            qty: l.rawQty,
            heightMm: l.rawHeightMm,
            isIgnored: l.isIgnored,
            manualPricePerM: pricePerM ?? pieceCost ?? undefined,
          };
        });

      // Build pieceMeta
      for (const line of importData.lines) {
        if (line.piece && line.pieceId) {
          const cost = line.piece.costs[0];
          pieceMeta[line.pieceId] = {
            id: line.pieceId,
            systemCode: line.piece.systemCode,
            usefulWidthM: line.piece.usefulWidthM ?? 0,
            lbsPerMCored: line.piece.lbsPerMCored ?? 0,
            lbsPerMUncored: line.piece.lbsPerMUncored ?? 0,
            volumePerM: line.piece.volumePerM ?? 0,
            cost: cost
              ? {
                  pricePer5000ftCored: cost.pricePer5000ftCored ?? 0,
                  pricePerFtCored: cost.pricePerFtCored ?? 0,
                  pricePerMCored: cost.pricePerMCored ?? 0,
                }
              : undefined,
          };
        }
      }
    }
  }

  // Get tax rules if provided; exclude "Local Margin" so we add a single "Commission (fixed)" line in the engine (Option A)
  let taxRules: TaxRule[] = [];
  if (data.taxRuleSetId) {
    const ruleSet = await prisma.taxRuleSet.findUnique({
      where: { id: data.taxRuleSetId },
    });
    if (ruleSet) {
      const raw = (ruleSet.rules as unknown as TaxRule[]) ?? [];
      taxRules = raw.filter((r) => !r.label?.toLowerCase().includes("local margin"));
    }
  }

  const snapshotInput = {
    method: data.costMethod,
    baseUom: data.baseUom,
    lines: data.costMethod === "CSV" ? csvImportLines : undefined,
    pieceMeta,
    m2S80: data.m2S80,
    m2S150: data.m2S150,
    m2S200: data.m2S200,
    m2Total: data.m2Total,
    orgDefaults: {
      baseUom: data.baseUom,
      minRunFt: org.minRunFt,
      rateS80: org.rateS80,
      rateS150: org.rateS150,
      rateS200: org.rateS200,
      rateGlobal: org.rateGlobal,
    },
    commissionPct: data.commissionPct,
    commissionFixed: data.commissionFixed,
    commissionFixedPerKit: data.commissionFixedPerKit,
    freightCostUsd: data.freightCostUsd,
    numContainers: data.numContainers,
    kitsPerContainer: data.kitsPerContainer,
    totalKits: data.totalKits,
    taxRules,
  };

  let snapshot = buildQuoteSnapshot(snapshotInput);

  if (snapshot.factoryCostUsd === 0 && (data.factoryCostUsd ?? 0) > 0) {
    snapshot = buildQuoteSnapshot({
      ...snapshotInput,
      overrideFactoryCostUsd: data.factoryCostUsd,
    });
  }

  const quoteNumber = generateQuoteNumber();

  // Create quote + lines + tax lines
  const quote = await prisma.quote.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      countryId: data.countryId,
      quoteNumber,
      costMethod: data.costMethod,
      baseUom: data.baseUom,
      revitImportId: data.revitImportId,
      warehouseId: data.warehouseId,
      reserveStock: data.reserveStock,
      factoryCostUsd: snapshot.factoryCostUsd,
      commissionPct: snapshot.commissionPct,
      commissionFixed: snapshot.commissionFixed,
      fobUsd: snapshot.fobUsd,
      freightProfileId: data.freightProfileId,
      freightCostUsd: snapshot.freightCostUsd,
      numContainers: snapshot.numContainers,
      kitsPerContainer: snapshot.kitsPerContainer,
      totalKits: snapshot.totalKits,
      cifUsd: snapshot.cifUsd,
      taxesFeesUsd: snapshot.taxesFeesUsd,
      landedDdpUsd: snapshot.landedDdpUsd,
      wallAreaM2S80: snapshot.wallAreaM2S80,
      wallAreaM2S150: snapshot.wallAreaM2S150,
      wallAreaM2S200: snapshot.wallAreaM2S200,
      wallAreaM2Total: snapshot.wallAreaM2Total,
      totalWeightKg: snapshot.totalWeightKgCored,
      totalVolumeM3: snapshot.totalVolumeM3,
      concreteM3: snapshot.concreteM3,
      steelKgEst: snapshot.steelKgEst,
      notes: data.notes,
      createdBy: user.id,
      snapshot: snapshot as any,
      lines: {
        create: snapshot.lines.map((l, i) => ({
          lineNum: i + 1,
          description: l.description,
          pieceId: l.pieceId,
          systemCode: l.systemCode ?? undefined,
          qty: l.qty,
          heightMm: l.heightMm,
          linearM: l.linearM,
          linearFt: l.linearFt,
          m2Line: l.m2Line,
          unitPrice: l.unitPrice,
          markupPct: l.markupPct,
          lineTotal: l.lineTotalWithMarkup,
          weightKgCored: l.weightKgCored,
          weightKgUncored: l.weightKgUncored,
          volumeM3: l.volumeM3,
          isBelowMinRun: l.isBelowMinRun,
          productionNeeded: l.productionNeeded,
        })),
      },
      taxLines: {
        create: snapshot.taxLines.map((tl) => ({
          order: tl.order,
          label: tl.label,
          base: tl.base as any,
          ratePct: tl.ratePct,
          fixedAmount: tl.fixedAmount,
          baseAmount: tl.baseAmount,
          computedAmount: tl.computedAmount,
          perContainer: tl.perContainer,
        })),
      },
    },
  });

  // Reserve inventory if requested
  if (data.reserveStock && data.warehouseId && snapshot.lines.length > 0) {
    for (const line of snapshot.lines) {
      if (!line.pieceId || line.isIgnored || line.qty <= 0) continue;

      const item = await prisma.inventoryItem.findFirst({
        where: {
          warehouseId: data.warehouseId,
          pieceId: line.pieceId,
        },
      });

      if (item) {
        const reserveQty = Math.min(line.qty, item.qtyAvailable);
        if (reserveQty > 0) {
          await prisma.inventoryMove.create({
            data: {
              itemId: item.id,
              type: "RESERVE",
              qty: reserveQty,
              quoteId: quote.id,
              performedBy: user.id,
              notes: `Reserved for quote ${quoteNumber}`,
            },
          });

          await prisma.inventoryItem.update({
            where: { id: item.id },
            data: {
              qtyReserved: { increment: reserveQty },
              qtyAvailable: { decrement: reserveQty },
            },
          });
        }
      }
    }
  }

  // If project has exactly one quote, set it as baseline and move from DRAFT to QUOTED
  const projectQuoteCount = await prisma.quote.count({ where: { projectId: data.projectId } });
  if (projectQuoteCount === 1) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { status: true },
    });
    const updateData: { baselineQuoteId: string; status?: "QUOTED" } = { baselineQuoteId: quote.id };
    if (project?.status === "DRAFT") {
      updateData.status = "QUOTED";
    }
    await prisma.project.update({
      where: { id: data.projectId },
      data: updateData,
    });
  }

  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "QUOTE_CREATED",
    entityType: "Quote",
    entityId: quote.id,
    meta: { quoteNumber, costMethod: data.costMethod },
  });

  return NextResponse.json(quote, { status: 201 });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseRevitCsv,
  matchPiece,
  buildCodeIndex,
  computeLineMetrics,
} from "@vbt/core";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = parseRevitCsv(csvText);

    // Load catalog for matching
    const catalog = await prisma.pieceCatalog.findMany({
      where: { isActive: true },
      include: { aliases: true, costs: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    });

    const codeIndex = buildCodeIndex(catalog);

    // Create RevitImport record
    const revitImport = await prisma.revitImport.create({
      data: {
        orgId: user.orgId,
        projectId: projectId ?? undefined,
        filename: file.name,
        uploadedBy: user.id,
        rowCount: parsed.totalRows,
        status: "PENDING",
      },
    });

    // Process each row
    let matchedCount = 0;
    let unmappedCount = 0;

    const lineData = [];

    for (const row of parsed.rows) {
      const match = matchPiece(
        { rawPieceCode: row.rawPieceCode, normalizedName: row.normalizedName },
        catalog,
        codeIndex
      );

      const isMatched = match.pieceId !== null;
      if (isMatched) matchedCount++;
      else unmappedCount++;

      // Compute metrics if matched
      const piece = isMatched
        ? catalog.find((p) => p.id === match.pieceId)
        : null;

      let linearM: number | null = null;
      let linearFt: number | null = null;
      let m2Line: number | null = null;
      let weightLbsCored: number | null = null;
      let weightLbsUncored: number | null = null;
      let weightKgCored: number | null = null;
      let weightKgUncored: number | null = null;
      let volumeM3: number | null = null;

      if (!row.parseError && row.rawQty > 0 && row.rawHeightMm > 0) {
        const metrics = computeLineMetrics({
          qty: row.rawQty,
          heightMm: row.rawHeightMm,
          usefulWidthM: piece?.usefulWidthM ?? 0,
          lbsPerMCored: piece?.lbsPerMCored ?? 0,
          lbsPerMUncored: piece?.lbsPerMUncored ?? 0,
          volumePerM: piece?.volumePerM ?? 0,
        });
        linearM = metrics.linearM;
        linearFt = metrics.linearFt;
        m2Line = metrics.m2Line;
        weightLbsCored = metrics.weightLbsCored;
        weightLbsUncored = metrics.weightLbsUncored;
        weightKgCored = metrics.weightKgCored;
        weightKgUncored = metrics.weightKgUncored;
        volumeM3 = metrics.volumeM3;
      }

      // Get latest cost
      const cost = piece?.costs[0];
      let pricePerM: number | null = null;
      let pricePerFt: number | null = null;

      if (cost) {
        if (cost.pricePerMCored && cost.pricePerMCored > 0) {
          pricePerM = cost.pricePerMCored;
          pricePerFt = cost.pricePerFtCored ?? pricePerM * 0.3048;
        } else if (cost.pricePerFtCored && cost.pricePerFtCored > 0) {
          pricePerFt = cost.pricePerFtCored;
          pricePerM = pricePerFt / 0.3048;
        } else if (cost.pricePer5000ftCored && cost.pricePer5000ftCored > 0) {
          pricePerFt = cost.pricePer5000ftCored / 5000;
          pricePerM = pricePerFt / 0.3048;
        }
      }

      lineData.push({
        importId: revitImport.id,
        rowNum: row.rowNum,
        rawPieceCode: row.rawPieceCode ?? null,
        rawPieceName: row.rawPieceName,
        rawQty: row.rawQty,
        rawHeightMm: row.rawHeightMm,
        pieceId: match.pieceId,
        matchMethod: match.matchMethod === "UNMATCHED" ? null : match.matchMethod,
        linearM,
        linearFt,
        m2Line,
        weightLbsCored,
        weightLbsUncored,
        weightKgCored,
        weightKgUncored,
        volumeM3,
        pricePerM,
        pricePerFt,
      });
    }

    // Bulk create lines
    await prisma.revitImportLine.createMany({ data: lineData });

    // Update import counts
    await prisma.revitImport.update({
      where: { id: revitImport.id },
      data: {
        matchedCount,
        unmappedCount,
        status: unmappedCount === 0 ? "MAPPED" : "PENDING",
      },
    });

    // Return import with lines
    const fullImport = await prisma.revitImport.findUnique({
      where: { id: revitImport.id },
      include: {
        lines: {
          include: { piece: { include: { costs: { take: 1 } } } },
          orderBy: { rowNum: "asc" },
        },
      },
    });

    return NextResponse.json(fullImport, { status: 201 });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Failed to parse CSV" }, { status: 500 });
  }
}

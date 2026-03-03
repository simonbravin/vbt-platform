import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { normalizeAliasRaw } from "@vbt/core";
import { computeLineMetrics } from "@vbt/core";

const mapSchema = z.object({
  lineId: z.string().min(1),
  pieceId: z.string().min(1),
  createAlias: z.boolean().default(true),
  ignore: z.boolean().optional().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const parsed = mapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { lineId, pieceId, createAlias, ignore } = parsed.data;

  // Get the line
  const line = await prisma.revitImportLine.findUnique({ where: { id: lineId } });
  if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

  if (ignore) {
    await prisma.revitImportLine.update({
      where: { id: lineId },
      data: { isIgnored: true, matchMethod: "IGNORED" },
    });
  } else {
    // Recompute metrics with new piece
    const piece = await prisma.pieceCatalog.findUnique({
      where: { id: pieceId },
      include: { costs: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    });

    let metricsUpdate: any = { pieceId, matchMethod: "MANUAL" };

    if (piece && line.rawQty > 0 && line.rawHeightMm > 0) {
      const metrics = computeLineMetrics({
        qty: line.rawQty,
        heightMm: line.rawHeightMm,
        usefulWidthM: piece.usefulWidthM ?? 0,
        lbsPerMCored: piece.lbsPerMCored ?? 0,
        lbsPerMUncored: piece.lbsPerMUncored ?? 0,
        volumePerM: piece.volumePerM ?? 0,
      });
      Object.assign(metricsUpdate, metrics);

      const cost = piece.costs[0];
      if (cost?.pricePerMCored) metricsUpdate.pricePerM = cost.pricePerMCored;
      if (cost?.pricePerFtCored) metricsUpdate.pricePerFt = cost.pricePerFtCored;
    }

    await prisma.revitImportLine.update({
      where: { id: lineId },
      data: metricsUpdate,
    });

    // Create alias if requested
    if (createAlias && line.rawPieceName) {
      const aliasNormalized = normalizeAliasRaw(line.rawPieceName);
      await prisma.pieceAlias
        .upsert({
          where: { aliasNormalized_pieceId: { aliasNormalized, pieceId } },
          update: {},
          create: {
            pieceId,
            orgId: user.orgId,
            aliasRaw: line.rawPieceName,
            aliasNormalized,
            source: "CSV_MAPPING",
          },
        })
        .catch(() => {}); // Ignore unique constraint
    }
  }

  // Recount import
  const importLines = await prisma.revitImportLine.findMany({
    where: { importId: params.id },
  });
  const matchedCount = importLines.filter((l) => l.pieceId && !l.isIgnored).length;
  const unmappedCount = importLines.filter((l) => !l.pieceId && !l.isIgnored).length;

  await prisma.revitImport.update({
    where: { id: params.id },
    data: {
      matchedCount,
      unmappedCount,
      status: unmappedCount === 0 ? "MAPPED" : "PENDING",
    },
  });

  return NextResponse.json({ success: true, matchedCount, unmappedCount });
}

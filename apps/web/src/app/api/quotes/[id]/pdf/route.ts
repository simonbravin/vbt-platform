import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfData } from "@/components/pdf/quote-pdf";
import React from "react";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const includeAlerts = url.searchParams.get("includeAlerts") === "1" || url.searchParams.get("includeAlerts") === "true";
  const includeMaterialLines = url.searchParams.get("includeMaterialLines") !== "0" && url.searchParams.get("includeMaterialLines") !== "false";
  const showUnitPrice = url.searchParams.get("showUnitPrice") !== "0" && url.searchParams.get("showUnitPrice") !== "false";

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: {
        project: true,
        country: true,
        createdByUser: { select: { name: true } },
        lines: { orderBy: { lineNum: "asc" } },
        taxLines: { orderBy: { order: "asc" } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const snapshot = (quote.snapshot as any) || {};

    const pdfData: QuotePdfData = {
      quoteNumber: quote.quoteNumber ?? quote.id.slice(0, 8).toUpperCase(),
      status: quote.status,
      createdAt: new Date(quote.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      sentAt: quote.sentAt
        ? new Date(quote.sentAt).toLocaleDateString()
        : undefined,
      project: {
        name: quote.project.name,
        client: quote.project.client ?? undefined,
        location: quote.project.location ?? undefined,
      },
      country: quote.country
        ? { name: quote.country.name, code: quote.country.code }
        : undefined,
      costMethod: quote.costMethod,
      baseUom: quote.baseUom,
      lines: quote.lines.map((l) => ({
        description: l.description ?? "",
        systemCode: l.systemCode ?? undefined,
        qty: Number(l.qty) || 0,
        heightMm: l.heightMm != null ? Number(l.heightMm) : undefined,
        linearM: l.linearM != null ? Number(l.linearM) : undefined,
        m2Line: l.m2Line != null ? Number(l.m2Line) : undefined,
        unitPrice: Number(l.unitPrice) || 0,
        markupPct: Number(l.markupPct) || 0,
        lineTotalWithMarkup: Number(l.lineTotal) || 0,
        isBelowMinRun: Boolean(l.isBelowMinRun),
        isIgnored: false,
      })),
      wallAreaM2S80: Number(quote.wallAreaM2S80) || 0,
      wallAreaM2S150: Number(quote.wallAreaM2S150) || 0,
      wallAreaM2S200: Number(quote.wallAreaM2S200) || 0,
      wallAreaM2Total: Number(quote.wallAreaM2Total) || 0,
      totalWeightKgCored: quote.totalWeightKg != null ? Number(quote.totalWeightKg) : undefined,
      totalVolumeM3: quote.totalVolumeM3 != null ? Number(quote.totalVolumeM3) : undefined,
      factoryCostUsd: Number(quote.factoryCostUsd) || 0,
      commissionPct: Number(quote.commissionPct) || 0,
      commissionFixed: Number(quote.commissionFixed) || 0,
      commissionAmount: Number(snapshot.commissionAmount) || 0,
      fobUsd: Number(quote.fobUsd) || 0,
      freightCostUsd: Number(quote.freightCostUsd) || 0,
      numContainers: Number(quote.numContainers) || 1,
      kitsPerContainer: Number(quote.kitsPerContainer) || 0,
      totalKits: Number(quote.totalKits) || 0,
      cifUsd: Number(quote.cifUsd) || 0,
      taxLines: quote.taxLines.map((tl) => {
        const rawLabel = tl.label ?? "";
        const label =
          tl.perContainer || /per container/i.test(rawLabel)
            ? rawLabel.replace(/\s*\(per container\)/gi, " (per order)")
            : rawLabel;
        return {
          label,
          computedAmount: Number(tl.computedAmount) || 0,
        };
      }),
      taxesFeesUsd: Number(quote.taxesFeesUsd) || 0,
      landedDdpUsd: Number(quote.landedDdpUsd) || 0,
      concreteM3: Number(quote.concreteM3) || 0,
      steelKgEst: Number(quote.steelKgEst) || 0,
      notes: quote.notes ?? undefined,
      quotedByName: quote.createdByUser?.name ?? undefined,
    };

    const pdfOptions = { includeAlerts, includeMaterialLines, showUnitPrice };
    const buffer = await renderToBuffer(
      React.createElement(QuotePdfDocument, { data: pdfData, options: pdfOptions }) as any
    );

    const filename = `VBT-Quote-${pdfData.quoteNumber}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

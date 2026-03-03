import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfData } from "@/components/pdf/quote-pdf";
import React from "react";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: {
        project: true,
        country: true,
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
        description: l.description,
        systemCode: l.systemCode ?? undefined,
        qty: l.qty,
        heightMm: l.heightMm ?? undefined,
        linearM: l.linearM ?? undefined,
        m2Line: l.m2Line ?? undefined,
        unitPrice: l.unitPrice ?? 0,
        markupPct: l.markupPct,
        lineTotalWithMarkup: l.lineTotal,
        isBelowMinRun: l.isBelowMinRun,
        isIgnored: false,
      })),
      wallAreaM2S80: quote.wallAreaM2S80,
      wallAreaM2S150: quote.wallAreaM2S150,
      wallAreaM2S200: quote.wallAreaM2S200,
      wallAreaM2Total: quote.wallAreaM2Total,
      totalWeightKgCored: quote.totalWeightKg,
      totalVolumeM3: quote.totalVolumeM3,
      factoryCostUsd: quote.factoryCostUsd,
      commissionPct: quote.commissionPct,
      commissionFixed: quote.commissionFixed,
      commissionAmount: snapshot.commissionAmount ?? 0,
      fobUsd: quote.fobUsd,
      freightCostUsd: quote.freightCostUsd,
      numContainers: quote.numContainers,
      kitsPerContainer: quote.kitsPerContainer,
      totalKits: quote.totalKits,
      cifUsd: quote.cifUsd,
      taxLines: quote.taxLines.map((tl) => ({
        label: tl.label,
        computedAmount: tl.computedAmount,
      })),
      taxesFeesUsd: quote.taxesFeesUsd,
      landedDdpUsd: quote.landedDdpUsd,
      concreteM3: quote.concreteM3,
      steelKgEst: quote.steelKgEst,
      notes: quote.notes ?? undefined,
    };

    const buffer = await renderToBuffer(
      React.createElement(QuotePdfDocument, { data: pdfData }) as any
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

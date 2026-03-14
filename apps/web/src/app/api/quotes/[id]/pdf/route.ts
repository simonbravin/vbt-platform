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
  const user = session.user as { activeOrgId?: string; orgId?: string; isPlatformSuperadmin?: boolean };
  const organizationId = user.activeOrgId ?? user.orgId;
  const isPlatformSuperadmin = !!user.isPlatformSuperadmin;

  const url = new URL(req.url);
  const includeAlerts = url.searchParams.get("includeAlerts") === "1" || url.searchParams.get("includeAlerts") === "true";
  const includeMaterialLines = url.searchParams.get("includeMaterialLines") !== "0" && url.searchParams.get("includeMaterialLines") !== "false";
  const showUnitPrice = url.searchParams.get("showUnitPrice") !== "0" && url.searchParams.get("showUnitPrice") !== "false";

  try {
    const quote = await prisma.quote.findFirst({
      where: { id: params.id, ...(isPlatformSuperadmin ? {} : { organizationId: organizationId ?? "" }) },
      include: {
        project: { include: { client: { select: { name: true } } } },
        preparedByUser: { select: { fullName: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const q = quote as any;
    const snapshot = q.snapshot || {};
    const project = quote.project as { projectName?: string; name?: string; client?: { name: string }; location?: string };
    const projectName = project.projectName ?? project.name ?? "";
    const clientName = project.client?.name ?? (quote.project as any).client ?? undefined;
    const lines = (quote.items ?? q.lines ?? []).map((l: any) => ({
      description: l.description ?? l.itemDescription ?? "",
      systemCode: l.systemCode ?? undefined,
      qty: Number(l.qty ?? l.quantity) || 0,
      heightMm: l.heightMm != null ? Number(l.heightMm) : undefined,
      linearM: l.linearM != null ? Number(l.linearM) : undefined,
      m2Line: l.m2Line != null ? Number(l.m2Line) : undefined,
      unitPrice: Number(l.unitPrice ?? l.unitPriceUsd) || 0,
      markupPct: Number(l.markupPct) || 0,
      lineTotalWithMarkup: Number(l.lineTotal ?? l.totalPrice) || 0,
      isBelowMinRun: Boolean(l.isBelowMinRun),
      isIgnored: false,
    }));

    const factoryTotal = Number(q.factoryCostUsd ?? quote.factoryCostTotal) || 0;
    let factoryCostUsdPdf = factoryTotal;
    let basePriceForPartner: number | undefined;
    if (!isPlatformSuperadmin) {
      const platformRow = await prisma.platformConfig.findFirst({ select: { configJson: true } });
      const raw = (platformRow?.configJson as { pricing?: { visionLatamCommissionPct?: number } })?.pricing;
      const commissionPct = raw?.visionLatamCommissionPct ?? 20;
      basePriceForPartner = factoryTotal * (1 + commissionPct / 100);
      factoryCostUsdPdf = 0;
    }
    const pdfData: QuotePdfData = {
      quoteNumber: (quote as { quoteNumber?: string }).quoteNumber ?? quote.id.slice(0, 8).toUpperCase(),
      status: quote.status,
      createdAt: new Date(quote.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      sentAt: q.sentAt ? new Date(q.sentAt).toLocaleDateString() : undefined,
      project: { name: projectName, client: clientName, location: project.location ?? undefined },
      country: q.country ? { name: q.country.name, code: q.country.code } : undefined,
      costMethod: q.costMethod ?? "M2_TOTAL",
      baseUom: q.baseUom ?? "M",
      lines,
      wallAreaM2S80: Number(q.wallAreaM2S80) || 0,
      wallAreaM2S150: Number(q.wallAreaM2S150) || 0,
      wallAreaM2S200: Number(q.wallAreaM2S200) || 0,
      wallAreaM2Total: Number(q.wallAreaM2Total) || 0,
      totalWeightKgCored: q.totalWeightKg != null ? Number(q.totalWeightKg) : undefined,
      totalVolumeM3: q.totalVolumeM3 != null ? Number(q.totalVolumeM3) : undefined,
      factoryCostUsd: factoryCostUsdPdf,
      ...(basePriceForPartner != null && { basePriceForPartner }),
      commissionPct: Number(q.commissionPct) || 0,
      commissionFixed: Number(q.commissionFixed) || 0,
      commissionAmount: Number(snapshot.commissionAmount) || 0,
      fobUsd: Number(q.fobUsd) || 0,
      freightCostUsd: Number(q.freightCostUsd) || 0,
      numContainers: Number(q.numContainers) || 1,
      kitsPerContainer: Number(q.kitsPerContainer) || 0,
      totalKits: Number(q.totalKits) || 0,
      cifUsd: Number(q.cifUsd) || 0,
      taxLines: (q.taxLines ?? []).map((tl: any) => ({
        label: tl.label ?? "",
        computedAmount: Number(tl.computedAmount) || 0,
      })),
      taxesFeesUsd: Number(q.taxesFeesUsd) || 0,
      landedDdpUsd: Number(q.landedDdpUsd ?? quote.totalPrice) || 0,
      concreteM3: Number(q.concreteM3) || 0,
      steelKgEst: Number(q.steelKgEst) || 0,
      notes: (quote as { notes?: string }).notes ?? undefined,
      quotedByName: (quote as { preparedByUser?: { fullName?: string } }).preparedByUser?.fullName ?? undefined,
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

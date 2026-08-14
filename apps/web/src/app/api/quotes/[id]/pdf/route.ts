import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfData } from "@/components/pdf/quote-pdf";
import { loadPdfLogoDataUrl } from "@/components/pdf/load-pdf-logo";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { requireModuleRouteAuth } from "@/lib/module-route-auth";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";
import { normalizeApiError } from "@/lib/api-error";
import { toLegacySalesQuoteShape } from "@vbt/core";
import React from "react";

function getLocaleFromRequest(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
  const value = match?.[1];
  return value === "es" ? "es" : "en";
}

function projectLocationLabel(project: {
  city?: string | null;
  address?: string | null;
}): string | undefined {
  const city = project.city?.trim() || "";
  const address = project.address?.trim() || "";
  if (city && address) return `${city} - ${address}`;
  if (city) return city;
  if (address) return address;
  return undefined;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireModuleRouteAuth("quotes");
  if (!auth.ok) return auth.response;
  const user = auth.user as { activeOrgId?: string; orgId?: string; isPlatformSuperadmin?: boolean };
  const organizationId = getEffectiveOrganizationId(user);
  const isPlatformSuperadmin = !!user.isPlatformSuperadmin;

  const url = new URL(req.url);
  const locale = getLocaleFromRequest(req);
  const includeAlerts =
    url.searchParams.get("includeAlerts") === "1" ||
    url.searchParams.get("includeAlerts") === "true";
  const includeMaterialLines =
    url.searchParams.get("includeMaterialLines") !== "0" &&
    url.searchParams.get("includeMaterialLines") !== "false";
  const showUnitPrice =
    url.searchParams.get("showUnitPrice") !== "0" &&
    url.searchParams.get("showUnitPrice") !== "false";

  try {
    const quote = await prisma.quote.findFirst({
      where: {
        id: params.id,
        ...(isPlatformSuperadmin ? {} : { organizationId: organizationId ?? "" }),
      },
      include: {
        project: {
          include: {
            client: { select: { name: true } },
          },
        },
        preparedByUser: { select: { fullName: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const q = quote as Record<string, unknown>;
    const project = quote.project as {
      projectName?: string;
      name?: string;
      client?: { name: string };
      city?: string | null;
      address?: string | null;
      countryCode?: string | null;
    } | null;

    if (!project) {
      return NextResponse.json({ error: "Quote project not found" }, { status: 422 });
    }

    const projectName = project.projectName ?? project.name ?? "";
    const clientName = project.client?.name ?? undefined;
    const location = projectLocationLabel(project);
    const countryCode = project.countryCode?.trim().toUpperCase() || null;

    let country: { name: string; code: string } | undefined;
    if (countryCode) {
      const countryRow = await prisma.country
        .findFirst({
          where: { code: countryCode },
          select: { name: true, code: true },
        })
        .catch(() => null);
      if (countryRow) {
        country = { name: countryRow.name, code: countryRow.code };
      } else {
        country = { name: countryCode, code: countryCode };
      }
    }

    const lines = (quote.items ?? []).map((l) => ({
      description: l.description ?? "",
      systemCode: undefined as string | undefined,
      qty: Number(l.quantity) || 0,
      heightMm: undefined as number | undefined,
      linearM: undefined as number | undefined,
      m2Line: undefined as number | undefined,
      unitPrice: Number(l.unitPrice) || 0,
      markupPct: Number(l.markupPct) || 0,
      lineTotalWithMarkup: Number(l.totalPrice) || 0,
      isBelowMinRun: false,
      isIgnored: false,
    }));

    let financial: Record<string, unknown>;
    try {
      financial = toLegacySalesQuoteShape(
        JSON.parse(JSON.stringify(quote)) as Record<string, unknown>
      );
    } catch (err) {
      const { status, payload } = normalizeApiError(err);
      return NextResponse.json(payload, { status });
    }

    const pricingBlock = financial.pricing as
      | {
          taxLines?: Array<{ label?: string; computedAmount?: number }>;
          technicalServiceUsd?: number;
        }
      | undefined;

    const rawTaxLines =
      Array.isArray(q.taxLines) && (q.taxLines as unknown[]).length > 0
        ? (q.taxLines as Array<{ label?: string; computedAmount?: number }>)
        : (pricingBlock?.taxLines ?? []);

    const taxLines = rawTaxLines.map((tl) => ({
      label: tl.label ?? "",
      computedAmount: Number(tl.computedAmount) || 0,
    }));

    const technicalServiceUsd = Math.max(
      0,
      Number(pricingBlock?.technicalServiceUsd ?? q.technicalServiceCost) || 0
    );

    const pdfData: QuotePdfData = {
      quoteNumber:
        (quote as { quoteNumber?: string }).quoteNumber ??
        quote.id.slice(0, 8).toUpperCase(),
      status: quote.status,
      createdAt: new Date(quote.createdAt).toLocaleDateString(
        locale === "es" ? "es-ES" : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      ),
      sentAt: q.sentAt ? new Date(String(q.sentAt)).toLocaleDateString() : undefined,
      project: {
        name: projectName,
        client: clientName,
        location,
      },
      country,
      costMethod: String(q.quoteCostMethod ?? q.costMethod ?? "M2_TOTAL"),
      baseUom: String(q.baseUom ?? "M"),
      lines,
      wallAreaM2S80: Number(q.wallAreaM2S80) || 0,
      wallAreaM2S150: Number(q.wallAreaM2S150) || 0,
      wallAreaM2S200: Number(q.wallAreaM2S200) || 0,
      wallAreaM2Total: Number(q.wallAreaM2Total) || 0,
      totalWeightKgCored: q.totalWeightKg != null ? Number(q.totalWeightKg) : undefined,
      totalVolumeM3: q.totalVolumeM3 != null ? Number(q.totalVolumeM3) : undefined,
      factoryCostUsd: 0,
      commissionPct: Number(q.commissionPct ?? financial.commissionPct) || 0,
      commissionFixed: Number(q.commissionFixed ?? financial.commissionFixed) || 0,
      commissionAmount: 0,
      fobUsd: Number(financial.fobUsd) || 0,
      freightCostUsd: Number(financial.freightCostUsd) || 0,
      numContainers: Number(q.numContainers) || 1,
      kitsPerContainer: Number(q.kitsPerContainer) || 0,
      totalKits: Number(q.totalKits) || 0,
      cifUsd: Number(financial.cifUsd) || 0,
      taxLines,
      technicalServiceUsd,
      taxesFeesUsd: Number(financial.taxesFeesUsd) || 0,
      landedDdpUsd: Number(financial.landedDdpUsd ?? quote.totalPrice) || 0,
      concreteM3: Number(q.concreteM3) || 0,
      steelKgEst: Number(q.steelKgEst) || 0,
      notes: (quote as { notes?: string }).notes ?? undefined,
      quotedByName:
        (quote as { preparedByUser?: { fullName?: string } }).preparedByUser?.fullName ??
        undefined,
      logoDataUrl: loadPdfLogoDataUrl(),
    };

    const pdfOptions = { includeAlerts, includeMaterialLines, showUnitPrice, locale };
    const buffer = await renderToBuffer(
      React.createElement(QuotePdfDocument, { data: pdfData, options: pdfOptions }) as Parameters<
        typeof renderToBuffer
      >[0]
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
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

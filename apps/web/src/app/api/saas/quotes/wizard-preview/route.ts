/**
 * POST: pricing preview for the quote wizard (same math as `from-wizard`, no persist).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTenantContext, isImpersonatingPartner } from "@/lib/tenant";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";
import { computeWizardQuoteArtifacts, QuoteTaxResolutionError } from "@vbt/core";

const previewBodySchema = z
  .object({
    projectId: z.string().min(1),
    costMethod: z.enum(["CSV", "M2_BY_SYSTEM"]),
    baseUom: z.enum(["M", "FT"]).default("M"),
    revitImportId: z.string().optional().nullable(),
    m2S80: z.number().min(0).default(0),
    m2S150: z.number().min(0).default(0),
    m2S200: z.number().min(0).default(0),
    m2Total: z.number().min(0).default(0),
    commissionPct: z.number().min(0).default(0),
    commissionFixed: z.number().min(0).default(0),
    commissionFixedPerKit: z.number().min(0).optional().default(0),
    freightCostUsd: z.number().min(0).default(0),
    freightProfileId: z.string().optional().nullable(),
    totalKits: z.number().int().min(0).default(0),
    partnerMarkupPct: z.number().optional(),
    destinationCountryCode: z.string().length(2).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.costMethod === "CSV" && !data.revitImportId?.trim()) {
      ctx.addIssue({ code: "custom", message: "revitImportId is required for CSV method", path: ["revitImportId"] });
    }
  });

async function postHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new ApiHttpError(401, "UNAUTHORIZED", "Unauthorized");
  const organizationId = ctx.activeOrgId;
  if (!organizationId) {
    throw new ApiHttpError(
      400,
      "NO_ACTIVE_ORG",
      "No active organization. Select an organization before previewing a quote."
    );
  }

  const body = await req.json();
  const parsed = previewBodySchema.safeParse(body);
  if (!parsed.success) throw parsed.error;

  const data = parsed.data;

  const projectOrg = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { organizationId: true, countryCode: true },
  });
  if (!projectOrg || projectOrg.organizationId !== organizationId) {
    throw new ApiHttpError(400, "PROJECT_ORG_MISMATCH", "Project not found for this organization.");
  }

  let artifacts;
  try {
    artifacts = await computeWizardQuoteArtifacts(prisma, {
      organizationId,
      isPlatformSuperadmin: !!ctx.isPlatformSuperadmin && !isImpersonatingPartner(ctx),
      pricingMaskFactoryExw: false,
      data: {
        projectId: data.projectId,
        costMethod: data.costMethod,
        baseUom: data.baseUom,
        revitImportId: data.revitImportId,
        m2S80: data.m2S80,
        m2S150: data.m2S150,
        m2S200: data.m2S200,
        m2Total: data.m2Total,
        commissionPct: data.commissionPct,
        commissionFixed: data.commissionFixed,
        commissionFixedPerKit: data.commissionFixedPerKit ?? 0,
        freightCostUsd: data.freightCostUsd,
        freightProfileId: data.freightProfileId,
        partnerMarkupPct: data.partnerMarkupPct,
        destinationCountryCode: data.destinationCountryCode,
        totalKits: data.totalKits,
      },
      project: projectOrg,
    });
  } catch (e) {
    if (e instanceof QuoteTaxResolutionError) {
      throw new ApiHttpError(400, e.code, e.message);
    }
    const code = e instanceof Error ? e.message : "WIZARD_PREVIEW_FAILED";
    const map: Record<string, { status: number; http: string; msg: string }> = {
      IMPORT_NOT_FOUND: { status: 404, http: "IMPORT_NOT_FOUND", msg: "CSV import not found." },
      WIZARD_CSV_NO_LINES: {
        status: 400,
        http: "WIZARD_CSV_NO_LINES",
        msg: "No priced lines from CSV import. Map or ignore all rows, then try again.",
      },
      FREIGHT_PROFILE_NOT_FOUND: {
        status: 400,
        http: "FREIGHT_PROFILE_NOT_FOUND",
        msg: "Freight profile not found or not available for your organization.",
      },
      DESTINATION_COUNTRY_REQUIRED: {
        status: 400,
        http: "DESTINATION_COUNTRY_REQUIRED",
        msg: "Select a destination country (or set the project country) to resolve taxes.",
      },
    };
    const m = map[code];
    if (m) throw new ApiHttpError(m.status, m.http, m.msg);
    throw e;
  }

  const { snapshot, fcl, freightTotalUsd, taxCountryCode, pricingReadModel } = artifacts;

  return NextResponse.json({
    taxCountryCode,
    freightTotalUsd,
    fcl,
    snapshot: {
      wallAreaM2S80: snapshot.wallAreaM2S80,
      wallAreaM2S150: snapshot.wallAreaM2S150,
      wallAreaM2S200: snapshot.wallAreaM2S200,
      wallAreaM2Total: snapshot.wallAreaM2Total,
      totalKits: snapshot.totalKits,
      numContainers: snapshot.numContainers,
      kitsPerContainer: snapshot.kitsPerContainer,
      totalVolumeM3: snapshot.totalVolumeM3,
      totalWeightKgCored: snapshot.totalWeightKgCored,
      concreteM3: snapshot.concreteM3,
      steelKgEst: snapshot.steelKgEst,
      factoryCostUsd: snapshot.factoryCostUsd,
      freightCostUsd: snapshot.freightCostUsd,
      landedDdpUsd: snapshot.landedDdpUsd,
    },
    pricing: pricingReadModel,
  });
}

export const POST = withSaaSHandler({ module: "quotes", rateLimitTier: "read" }, postHandler);

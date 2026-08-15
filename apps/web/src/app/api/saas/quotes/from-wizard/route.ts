/**
 * Create a quote from the multi-step wizard (CSV Revit import or m² by system).
 * Uses `computeWizardQuoteArtifacts` for FCL, freight profile × containers, destination country taxes, and SaaS layers.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTenantContext, isImpersonatingPartner, shouldMaskFactoryExw } from "@/lib/tenant";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";
import { generateQuoteNumber } from "@/lib/utils";
import { createActivityLog } from "@/lib/audit";
import {
  computeWizardQuoteArtifacts,
  createQuote,
  formatQuoteForSaaSApiWithSnapshot,
  projectHasCompletedEngineering,
  assertEngineeringRequestForQuote,
  QuoteTaxResolutionError,
} from "@vbt/core";
import type { Prisma } from "@vbt/db";

const wizardBodySchema = z
  .object({
    projectId: z.string().min(1),
    costMethod: z.enum(["CSV", "M2_BY_SYSTEM"]),
    baseUom: z.enum(["M", "FT"]).default("M"),
    revitImportId: z.string().optional().nullable(),
    warehouseId: z.string().optional().nullable(),
    reserveStock: z.boolean().optional().default(false),
    m2S80: z.number().min(0).default(0),
    m2S150: z.number().min(0).default(0),
    m2S200: z.number().min(0).default(0),
    m2Total: z.number().min(0).default(0),
    commissionPct: z.number().min(0).default(0),
    commissionFixed: z.number().min(0).default(0),
    commissionFixedPerKit: z.number().min(0).optional().default(0),
    /** Total USD logistics when not using a freight profile (manual). */
    freightCostUsd: z.number().min(0).default(0),
    freightProfileId: z.string().optional().nullable(),
    /** Ignored: derived server-side from volume and `containerCapacityM3`. */
    numContainers: z.number().int().min(0).optional(),
    kitsPerContainer: z.number().int().min(0).optional(),
    totalKits: z.number().int().min(0).default(0),
    partnerMarkupPct: z.number().optional(),
    /** ISO 3166-1 alpha-2; used for tax rules and partner policy overrides. Falls back to project country. */
    destinationCountryCode: z.string().length(2).optional().nullable(),
    countryId: z.string().optional().nullable(),
    taxRuleSetId: z.string().optional().nullable(),
    notes: z.string().max(32000).optional().nullable(),
    engineeringRequestId: z.string().min(1).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.costMethod === "CSV" && !data.revitImportId?.trim()) {
      ctx.addIssue({ code: "custom", message: "revitImportId is required for CSV method", path: ["revitImportId"] });
    }
  });

async function postHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) {
    throw new ApiHttpError(401, "UNAUTHORIZED", "Unauthorized");
  }
  const organizationId = ctx.activeOrgId;
  if (!organizationId) {
    throw new ApiHttpError(
      400,
      "NO_ACTIVE_ORG",
      "No active organization. Select an organization before creating a quote."
    );
  }
  const body = await req.json();
  const parsed = wizardBodySchema.safeParse(body);
  if (!parsed.success) throw parsed.error;

  const data = parsed.data;
  const tenantCtx = {
    userId: ctx.userId,
    organizationId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };

  const projectOrg = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { organizationId: true, countryCode: true },
  });
  if (!projectOrg || projectOrg.organizationId !== organizationId) {
    throw new ApiHttpError(400, "PROJECT_ORG_MISMATCH", "Project not found for this organization.");
  }

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { organizationId },
    select: { requireDeliveredEngineeringForQuotes: true },
  });
  if (partnerProfile?.requireDeliveredEngineeringForQuotes) {
    const ok = await projectHasCompletedEngineering(prisma, organizationId, data.projectId);
    if (!ok) {
      throw new ApiHttpError(
        400,
        "ENGINEERING_NOT_DELIVERED",
        "This partner requires at least one completed engineering request for the project before creating quotes."
      );
    }
  }

  try {
    await assertEngineeringRequestForQuote(
      prisma,
      organizationId,
      data.projectId,
      data.engineeringRequestId ?? null
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid engineering request";
    throw new ApiHttpError(400, "ENGINEERING_REQUEST_INVALID", msg);
  }

  let artifacts;
  try {
    artifacts = await computeWizardQuoteArtifacts(prisma, {
      organizationId,
      // Partner portal (incl. VL impersonating) must persist partner landed math, not factory EXW.
      isPlatformSuperadmin: !!ctx.isPlatformSuperadmin && !isImpersonatingPartner(ctx),
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
    const code = e instanceof Error ? e.message : "WIZARD_COMPUTE_FAILED";
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

  const { snapshot, canon, taxRules } = artifacts;

  const quoteNumber = generateQuoteNumber();

  const quote = await createQuote(prisma, tenantCtx, {
    projectId: data.projectId,
    quoteNumber,
    visionLatamMarkupPct: canon.visionLatamMarkupPct,
    partnerMarkupPct: canon.partnerMarkupPct,
    logisticsCost: canon.logisticsCostUsd,
    importCost: canon.importCostUsd,
    localTransportCost: canon.localTransportCostUsd,
    technicalServiceCost: canon.technicalServiceUsd,
    factoryCostTotal: canon.factoryCostTotal,
    totalPrice: canon.totalPrice,
    items: canon.items,
    engineeringRequestId: data.engineeringRequestId ?? null,
    taxRulesSnapshotJson: taxRules as unknown as Prisma.InputJsonValue,
    notes: data.notes ?? null,
    revitImportId: data.revitImportId?.trim() || null,
    quoteCostMethod: data.costMethod,
    wallAreaM2S80: snapshot.wallAreaM2S80,
    wallAreaM2S150: snapshot.wallAreaM2S150,
    wallAreaM2S200: snapshot.wallAreaM2S200,
    wallAreaM2Total: snapshot.wallAreaM2Total,
    totalKits: snapshot.totalKits,
    numContainers: snapshot.numContainers,
    kitsPerContainer: snapshot.kitsPerContainer,
    totalWeightKg: snapshot.totalWeightKgCored,
    totalVolumeM3: snapshot.totalVolumeM3,
    concreteM3: snapshot.concreteM3,
    steelKgEst: snapshot.steelKgEst,
  });

  await createActivityLog({
    organizationId,
    userId: ctx.userId,
    action: "quote_created",
    entityType: "quote",
    entityId: quote.id,
    metadata: { quoteNumber, projectId: data.projectId, source: "wizard" },
  });

  return NextResponse.json(
    formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: shouldMaskFactoryExw(ctx) }),
    { status: 201 }
  );
}

export const POST = withSaaSHandler({ module: "quotes", rateLimitTier: "create_update" }, postHandler);

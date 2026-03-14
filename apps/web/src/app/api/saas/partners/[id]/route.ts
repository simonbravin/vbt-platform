import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getPartnerById, updatePartner } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional().or(z.literal("")),
  website: z.string().max(500).nullable().optional().or(z.literal("")),
  country: z.string().nullable().optional(),
  partnerType: z.enum(["commercial_partner", "master_partner"]).optional(),
  engineeringFeeMode: z.enum(["fixed", "percent", "per_request", "included"]).nullable().optional(),
  engineeringFeeValue: z.number().nullable().optional(),
  status: z.string().optional(),
  entryFeeUsd: z.number().nullable().optional(),
  trainingFeeUsd: z.number().nullable().optional(),
  materialCreditUsd: z.number().nullable().optional(),
  marginMinPct: z.number().nullable().optional(),
  marginMaxPct: z.number().nullable().optional(),
  minimumPricePolicy: z.string().nullable().optional(),
  salesTargetAnnualUsd: z.number().nullable().optional(),
  salesTargetAnnualM2: z.number().nullable().optional(),
  agreementStartDate: z.string().nullable().optional(),
  agreementEndDate: z.string().nullable().optional(),
  agreementStatus: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requirePlatformSuperadmin();
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: true,
    };
    const partner = await getPartnerById(prisma, tenantCtx, params.id);
    if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(partner);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePlatformSuperadmin();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const ctx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: true,
    };
    const data = parsed.data;
    const partner = await updatePartner(prisma, ctx, params.id, {
      companyName: data.companyName,
      contactName: data.contactName,
      contactEmail: data.contactEmail === "" ? null : data.contactEmail,
      website: data.website === "" ? null : data.website,
      country: data.country,
      partnerType: data.partnerType,
      engineeringFeeMode: data.engineeringFeeMode,
      engineeringFeeValue: data.engineeringFeeValue,
      status: data.status,
      entryFeeUsd: data.entryFeeUsd,
      trainingFeeUsd: data.trainingFeeUsd,
      materialCreditUsd: data.materialCreditUsd,
      marginMinPct: data.marginMinPct,
      marginMaxPct: data.marginMaxPct,
      minimumPricePolicy: data.minimumPricePolicy ?? undefined,
      salesTargetAnnualUsd: data.salesTargetAnnualUsd,
      salesTargetAnnualM2: data.salesTargetAnnualM2,
      agreementStartDate: data.agreementStartDate ?? undefined,
      agreementEndDate: data.agreementEndDate ?? undefined,
      agreementStatus: data.agreementStatus ?? undefined,
    });
    await createActivityLog({
      organizationId: partner.id,
      userId: user.userId ?? user.id,
      action: "partner_updated",
      entityType: "organization",
      entityId: partner.id,
      metadata: { companyName: partner.name },
    });
    return NextResponse.json(partner);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Partner not found") {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }
    throw e;
  }
}

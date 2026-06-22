import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import {
  getPlatformConfig,
  updatePlatformConfig,
  getEffectivePlatformPricingForAdmin,
  type UpdatePlatformConfigInput,
} from "@vbt/core";
import { z } from "zod";

const nullablePct = z.number().min(0).max(100).nullable().optional();
const nullableMoney = z.number().min(0).nullable().optional();
const nullableRate = z.number().min(0).nullable().optional();

const patchSchema = z.object({
  pricing: z
    .object({
      defaultMarginMinPct: nullablePct,
      defaultMarginMaxPct: nullablePct,
      defaultEntryFeeUsd: nullableMoney,
      defaultTrainingFeeUsd: nullableMoney,
      visionLatamCommissionPct: nullablePct,
      rateS80: nullableRate,
      rateS150: nullableRate,
      rateS200: nullableRate,
      rateGlobal: nullableRate,
      baseUom: z.enum(["M", "FT"]).optional(),
      minRunFt: z.number().min(0).optional(),
    })
    .optional(),
  moduleVisibility: z.record(z.boolean()).optional(),
});

async function buildAdminConfigResponse(tenantCtx: {
  userId: string;
  organizationId: string | null;
  isPlatformSuperadmin: true;
}) {
  const config = await getPlatformConfig(prisma, tenantCtx);
  const effectivePricing = await getEffectivePlatformPricingForAdmin(prisma);
  return { ...config, effectivePricing };
}

export async function GET() {
  try {
    const ctx = await getTenantContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePlatformSuperadmin();
    const payload = await buildAdminConfigResponse({
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: true,
    });
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("platform-config GET error:", e);
    return NextResponse.json({ error: "Failed to load configuration" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePlatformSuperadmin();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: true as const,
    };
    const input: UpdatePlatformConfigInput = {};
    if (parsed.data.pricing) {
      input.pricing = parsed.data.pricing as UpdatePlatformConfigInput["pricing"];
    }
    if (parsed.data.moduleVisibility) input.moduleVisibility = parsed.data.moduleVisibility;
    await updatePlatformConfig(prisma, tenantCtx, input);
    const payload = await buildAdminConfigResponse(tenantCtx);
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

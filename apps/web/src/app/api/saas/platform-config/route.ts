import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getPlatformConfig, updatePlatformConfig, type PlatformConfigJson } from "@vbt/core";
import { z } from "zod";

const patchSchema = z.object({
  pricing: z
    .object({
      defaultMarginMinPct: z.number().min(0).max(100).optional(),
      defaultEntryFeeUsd: z.number().min(0).optional(),
      defaultTrainingFeeUsd: z.number().min(0).optional(),
      visionLatamCommissionPct: z.number().min(0).max(100).optional(),
    })
    .optional(),
  moduleVisibility: z.record(z.boolean()).optional(),
});

export async function GET() {
  try {
    const ctx = await getTenantContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePlatformSuperadmin();
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: true,
    };
    const config = await getPlatformConfig(prisma, tenantCtx);
    return NextResponse.json(config);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
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
      isPlatformSuperadmin: true,
    };
    const input: Partial<PlatformConfigJson> = {};
    if (parsed.data.pricing) input.pricing = parsed.data.pricing;
    if (parsed.data.moduleVisibility) input.moduleVisibility = parsed.data.moduleVisibility;
    const config = await updatePlatformConfig(prisma, tenantCtx, input);
    return NextResponse.json(config);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

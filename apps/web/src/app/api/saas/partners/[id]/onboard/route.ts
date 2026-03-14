import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getPartnerOnboarding, updatePartnerOnboarding, type OnboardingState } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const ONBOARDING_STATES = ["application_received", "agreement_signed", "training_started", "training_completed", "active"] as const;

const postSchema = z.object({
  state: z.enum(ONBOARDING_STATES),
});

const patchSchema = z.object({
  state: z.enum(ONBOARDING_STATES),
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
    const result = await getPartnerOnboarding(prisma, tenantCtx, params.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Partner profile not found") {
      return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getTenantContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requirePlatformSuperadmin();
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const ctx = {
      userId: user.userId,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: true,
    };
    await updatePartnerOnboarding(prisma, ctx, params.id, parsed.data.state as OnboardingState);
    const result = await getPartnerOnboarding(prisma, ctx, params.id);
    await createActivityLog({
      organizationId: params.id,
      userId: user.userId,
      action: "partner_onboarded",
      entityType: "organization",
      entityId: params.id,
      metadata: { onboardingState: parsed.data.state },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Partner profile not found") {
      return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
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
    await updatePartnerOnboarding(prisma, ctx, params.id, parsed.data.state as OnboardingState);
    const result = await getPartnerOnboarding(prisma, ctx, params.id);
    await createActivityLog({
      organizationId: params.id,
      userId: user.userId ?? user.id,
      action: "partner_onboarded",
      entityType: "organization",
      entityId: params.id,
      metadata: { onboardingState: parsed.data.state },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Partner profile not found") {
      return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
    }
    throw e;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { listPartnerTerritories, addPartnerTerritory } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const postSchema = z.object({
  territoryType: z.enum(["exclusive", "open", "referral"]),
  countryCode: z.string().length(2),
  region: z.string().nullable().optional(),
  exclusive: z.boolean().optional(),
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
    const territories = await listPartnerTerritories(prisma, tenantCtx, params.id);
    return NextResponse.json(territories);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePlatformSuperadmin();
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
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
    const territory = await addPartnerTerritory(prisma, ctx, params.id, parsed.data);
    await createActivityLog({
      organizationId: params.id,
      userId: user.userId ?? user.id,
      action: "territory_assigned",
      entityType: "partner_territory",
      entityId: territory.id,
      metadata: { countryCode: territory.countryCode, region: territory.region },
    });
    return NextResponse.json(territory, { status: 201 });
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { removeTerritory } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getTenantContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requirePlatformSuperadmin();
    const territory = await prisma.partnerTerritory.findUnique({
      where: { id: params.id },
    });
    const ctx = {
      userId: user.userId,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: true,
    };
    const result = await removeTerritory(prisma, ctx, params.id);
    if (territory) {
      await createActivityLog({
        organizationId: territory.organizationId,
        userId: user.userId,
        action: "territory_removed",
        entityType: "partner_territory",
        entityId: params.id,
        metadata: { countryCode: territory.countryCode },
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Territory not found") {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 });
    }
    throw e;
  }
}

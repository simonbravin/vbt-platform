import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId, requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    const orgId = getEffectiveOrganizationId(user);
    if (!orgId && !user.isPlatformSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    const project = await prisma.project.findFirst({
      where: { id: params.id, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const logs = await prisma.activityLog.findMany({
      where: { entityType: "Project", entityId: params.id },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        action: l.action,
        createdAt: l.createdAt,
        userName: l.user?.fullName ?? null,
        meta: l.metadataJson,
      }))
    );
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

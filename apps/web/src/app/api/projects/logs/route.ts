import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

    const where: { organizationId?: string; entityType: string } = { entityType: "Project" };
    if (ctx.activeOrgId) where.organizationId = ctx.activeOrgId;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityId: l.entityId,
        meta: l.metadataJson,
        createdAt: l.createdAt,
        userName: l.user?.fullName ?? null,
      })),
      total,
      page,
      limit,
    });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

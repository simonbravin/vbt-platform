import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireModuleRouteAuth } from "@/lib/module-route-auth";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireModuleRouteAuth("quotes");
  if (!auth.ok) return auth.response;
  const user = auth.user as any;

  const orgId = user.isPlatformSuperadmin
    ? await getEffectiveActiveOrgId(user)
    : getEffectiveOrganizationId(user);
  const quote = await prisma.quote.findFirst({
    where: {
      id: params.id,
      ...(user.isPlatformSuperadmin && !orgId ? {} : { organizationId: orgId ?? "" }),
    },
    select: { id: true },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  const logs = await prisma.activityLog.findMany({
    where: { entityType: "Quote", entityId: params.id, ...(orgId ? { organizationId: orgId } : {}) },
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      userName: (l.user as { fullName?: string })?.fullName ?? null,
      meta: l.metadataJson,
    }))
  );
}

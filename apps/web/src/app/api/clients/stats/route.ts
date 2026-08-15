import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import type { SessionUser } from "@/lib/auth";
import { requireModuleRouteAuth } from "@/lib/module-route-auth";

export async function GET(req: Request) {
  const auth = await requireModuleRouteAuth("clients");
  if (!auth.ok) return auth.response;
  const user = auth.user as SessionUser & { activeOrgId?: string; orgId?: string };
  const organizationId = user.isPlatformSuperadmin
    ? await getEffectiveActiveOrgId(user)
    : getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json({ topByProjects: [], topBySold: [] });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 20);

  try {
    const topClients = await prisma.client.findMany({
      where: { organizationId },
      select: { id: true, name: true, _count: { select: { projects: true } } },
      orderBy: { projects: { _count: "desc" } },
      take: limit,
    });
    const topByProjects = topClients.map((c) => ({
      clientId: c.id,
      clientName: c.name,
      projectCount: c._count.projects,
    }));
    const topBySold: { clientId: string; clientName: string | null; totalSold: number }[] = [];
    return NextResponse.json({ topByProjects, topBySold });
  } catch (err) {
    console.error("[api/clients/stats]", err);
    return NextResponse.json({ topByProjects: [], topBySold: [], error: true });
  }
}

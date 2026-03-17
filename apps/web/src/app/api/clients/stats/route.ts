import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import type { SessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser & { activeOrgId?: string; orgId?: string };
  const effectiveOrgId = await getEffectiveActiveOrgId(user);
  const organizationId = effectiveOrgId ?? getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json({ topByProjects: [], topBySold: [] });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 20);

  try {
    const allClientsWithCount = await prisma.client.findMany({
      where: { organizationId },
      select: { id: true, name: true, _count: { select: { projects: true } } },
    });
    const topByProjects = allClientsWithCount
      .sort((a, b) => b._count.projects - a._count.projects)
      .slice(0, limit)
      .map((c) => ({ clientId: c.id, clientName: c.name, projectCount: c._count.projects }));
    const topBySold: { clientId: string; clientName: string | null; totalSold: number }[] = [];
    return NextResponse.json({ topByProjects, topBySold });
  } catch (err) {
    console.error("[api/clients/stats]", err);
    return NextResponse.json({ topByProjects: [], topBySold: [], error: true });
  }
}

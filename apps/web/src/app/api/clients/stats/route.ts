import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { activeOrgId?: string; orgId?: string };
  const organizationId = user.activeOrgId ?? user.orgId;
  if (!organizationId) return NextResponse.json({ topByProjects: [], topBySold: [] });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10"), 20);

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
}

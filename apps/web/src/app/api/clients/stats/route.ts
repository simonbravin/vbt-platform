import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10"), 20);

  const allClientsWithCount = await prisma.client.findMany({
    where: { orgId: user.orgId },
    select: { id: true, name: true, _count: { select: { projects: true } } },
  });
  const topByProjects = allClientsWithCount
    .sort((a, b) => b._count.projects - a._count.projects)
    .slice(0, limit)
    .map((c) => ({ clientId: c.id, clientName: c.name, projectCount: c._count.projects }));

  const soldByClient = await prisma.project.groupBy({
    by: ["clientId"],
    where: { orgId: user.orgId, status: "SOLD", clientId: { not: null } },
    _sum: { finalAmountUsd: true },
  });

  const clientIds = soldByClient.map((x) => x.clientId).filter(Boolean) as string[];
  const clientNames = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = Object.fromEntries(clientNames.map((c) => [c.id, c.name]));

  const topBySold = soldByClient
    .map((x) => ({
      clientId: x.clientId,
      clientName: nameMap[x.clientId!] ?? null,
      totalSold: x._sum.finalAmountUsd ?? 0,
    }))
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, limit);

  return NextResponse.json({ topByProjects, topBySold });
}

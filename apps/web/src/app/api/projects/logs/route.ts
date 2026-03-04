import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { orgId: user.orgId, entityType: "Project" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.auditLog.count({
      where: { orgId: user.orgId, entityType: "Project" },
    }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityId: l.entityId,
      meta: l.meta,
      createdAt: l.createdAt,
      userName: l.user?.name ?? null,
    })),
    total,
    page,
    limit,
  });
}

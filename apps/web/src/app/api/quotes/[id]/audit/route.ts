import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, organizationId: (user as any).activeOrgId ?? user.orgId },
    select: { id: true },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const orgId = (user as any).activeOrgId ?? user.orgId;
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

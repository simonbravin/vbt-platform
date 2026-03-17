import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const orgId = getEffectiveOrganizationId(user);
  const quote = await prisma.quote.findFirst({
    where: { id: params.id, organizationId: orgId ?? "" },
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const organizationId = (user as any).activeOrgId ?? user.orgId;
  const quote = await prisma.quote.findFirst({
    where: { id: params.id, organizationId },
    include: {
      project: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const isPlatformSuperadmin = !!(user as { isPlatformSuperadmin?: boolean }).isPlatformSuperadmin;
  if (!isPlatformSuperadmin) {
    const platformRow = await prisma.platformConfig.findFirst({ select: { configJson: true } });
    const raw = (platformRow?.configJson as { pricing?: { visionLatamCommissionPct?: number } })?.pricing;
    const commissionPct = raw?.visionLatamCommissionPct ?? 20;
    const factory = Number((quote as { factoryCostTotal?: number }).factoryCostTotal ?? 0);
    const payload = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
    payload.factoryCostTotal = null;
    payload.factoryCostUsd = null;
    payload.basePriceForPartner = factory * (1 + commissionPct / 100);
    return NextResponse.json(payload);
  }
  return NextResponse.json(quote);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, organizationId: (user as any).activeOrgId ?? user.orgId },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const status = body.status;
  const notes = body.notes;
  const data: Record<string, unknown> = {};
  if (status && ["draft", "sent", "accepted"].includes(status)) data.status = status;
  if (typeof notes === "string") data.notes = notes;

  if (Object.keys(data).length > 0) {
    await prisma.quote.update({
      where: { id: params.id },
      data: data as any,
    });
    await createAuditLog({
      orgId: (user as any).activeOrgId ?? user.orgId,
      userId: user.id,
      action: data.status === "ARCHIVED" ? "QUOTE_ARCHIVED" : "QUOTE_UPDATED",
      entityType: "Quote",
      entityId: params.id,
      meta: { changed: Object.keys(data) },
    });
    const updated = await prisma.quote.findFirst({
      where: { id: params.id },
      include: { project: true, items: true },
    });
    return NextResponse.json(updated);
  }
  return NextResponse.json(quote);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, organizationId: (user as any).activeOrgId ?? user.orgId },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  await createAuditLog({
    orgId: (user as any).activeOrgId ?? user.orgId,
    userId: user.id,
    action: "QUOTE_DELETED",
    entityType: "Quote",
    entityId: params.id,
    meta: { quoteNumber: (quote as { quoteNumber?: string }).quoteNumber ?? params.id },
  });

  await prisma.quote.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { createActivityLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const organizationId = getEffectiveOrganizationId(user);
  const quote = await prisma.quote.findFirst({
    where: { id: params.id, organizationId: organizationId ?? undefined },
    include: {
      project: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const isPlatformSuperadmin = !!(user as { isPlatformSuperadmin?: boolean }).isPlatformSuperadmin;
  if (!isPlatformSuperadmin) {
    const factory = Number((quote as { factoryCostTotal?: number }).factoryCostTotal ?? 0);
    const pct = Number((quote as { visionLatamMarkupPct?: number }).visionLatamMarkupPct ?? 0);
    const payload = JSON.parse(JSON.stringify(quote)) as Record<string, unknown>;
    payload.factoryCostTotal = null;
    payload.factoryCostUsd = null;
    payload.basePriceForPartner = factory * (1 + pct / 100);
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
    where: { id: params.id, organizationId: getEffectiveOrganizationId(user) ?? "" },
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
    await createActivityLog({
      organizationId: getEffectiveOrganizationId(user) ?? undefined,
      userId: user.id,
      action: data.status === "ARCHIVED" ? "QUOTE_ARCHIVED" : "QUOTE_UPDATED",
      entityType: "Quote",
      entityId: params.id,
      metadata: { changed: Object.keys(data) },
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
    where: { id: params.id, organizationId: getEffectiveOrganizationId(user) ?? "" },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  await createActivityLog({
    organizationId: getEffectiveOrganizationId(user) ?? undefined,
    userId: user.id,
    action: "QUOTE_DELETED",
    entityType: "Quote",
    entityId: params.id,
    metadata: { quoteNumber: (quote as { quoteNumber?: string }).quoteNumber ?? params.id },
  });

  await prisma.quote.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}

/**
 * @deprecated Legacy quote-by-id (session + Prisma). CANONICAL for CRUD: `/api/saas/quotes/[id]`.
 * Keep for PDF/email/audit and scripts until those surfaces call SaaS or shared handlers.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createActivityLog } from "@/lib/audit";
import { canDeleteQuote, canManageQuotes, isPlatformSuperadmin } from "@/lib/permissions";
import { quoteByIdWhere } from "@/lib/quote-scope";
import { formatQuoteForSaaSApiWithSnapshot, normalizeQuoteStatus, QuoteMissingTaxSnapshotError } from "@vbt/core";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  const scoped = quoteByIdWhere(user, params.id);
  if (!scoped.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quote = await prisma.quote.findFirst({
    where: scoped.where,
    include: {
      project: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  return NextResponse.json(
    formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: !isPlatformSuperadmin(user) })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!canManageQuotes(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scoped = quoteByIdWhere(user, params.id);
  if (!scoped.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quote = await prisma.quote.findFirst({
    where: scoped.where,
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawStatus = body.status;
  const notes = body.notes;
  const data: Record<string, unknown> = {};

  if (rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== "") {
    const normalized = normalizeQuoteStatus(rawStatus);
    if (normalized == null) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = normalized;
  }
  if (typeof notes === "string") data.notes = notes;

  if (Object.keys(data).length > 0) {
    await prisma.quote.update({
      where: { id: params.id },
      data,
    });

    const archived = data.status === "archived";

    await createActivityLog({
      organizationId: quote.organizationId ?? undefined,
      userId: user.id,
      action: archived ? "QUOTE_ARCHIVED" : "QUOTE_UPDATED",
      entityType: "Quote",
      entityId: params.id,
      metadata: { changed: Object.keys(data) },
    });
    const updated = await prisma.quote.findFirst({
      where: { id: params.id },
      include: { project: true, items: true },
    });
    try {
      return NextResponse.json(
        formatQuoteForSaaSApiWithSnapshot(updated ?? quote, {
          maskFactoryExw: !isPlatformSuperadmin(user),
        })
      );
    } catch (e) {
      if (e instanceof QuoteMissingTaxSnapshotError) {
        return NextResponse.json(
          { error: e.message, code: e.code, quoteId: e.quoteId },
          { status: 422 }
        );
      }
      throw e;
    }
  }
  try {
    return NextResponse.json(
      formatQuoteForSaaSApiWithSnapshot(quote, { maskFactoryExw: !isPlatformSuperadmin(user) })
    );
  } catch (e) {
    if (e instanceof QuoteMissingTaxSnapshotError) {
      return NextResponse.json(
        { error: e.message, code: e.code, quoteId: e.quoteId },
        { status: 422 }
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!canDeleteQuote(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scoped = quoteByIdWhere(user, params.id);
  if (!scoped.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quote = await prisma.quote.findFirst({
    where: scoped.where,
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  await createActivityLog({
    organizationId: quote.organizationId ?? undefined,
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

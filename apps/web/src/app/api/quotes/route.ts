/**
 * @deprecated Legacy quotes list/create (session + Prisma). CANONICAL: `/api/saas/quotes`.
 * Keep GET list for integraciones que aún esperan array plano; el dashboard usa `/api/saas/quotes` + mapeo en cliente.
 * POST remains 501 — create via SaaS.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { normalizeQuoteStatus, QuoteMissingTaxSnapshotError, toLegacySalesQuoteShape } from "@vbt/core";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get("status") ?? "";
  const statusNorm = statusRaw.trim() ? normalizeQuoteStatus(statusRaw) : null;
  const projectId = url.searchParams.get("projectId") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim();

  const organizationId = getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json([]);

  const where: any = {
    organizationId,
    ...(statusNorm ? { status: statusNorm } : {}),
    ...(projectId ? { projectId } : {}),
  };

  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" } },
      { project: { projectName: { contains: search, mode: "insensitive" } } },
      { project: { client: { name: { contains: search, mode: "insensitive" } } } },
      { project: { city: { contains: search, mode: "insensitive" } } },
    ];
  }

  try {
    const quotes = await prisma.quote.findMany({
      where,
      include: {
        project: {
          select: {
            projectName: true,
            id: true,
            countryCode: true,
            client: { select: { name: true } },
            city: true,
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      quotes.map((row) => toLegacySalesQuoteShape({ ...(row as object) } as Record<string, unknown>))
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

export async function POST(_req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (["VIEWER", "viewer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Quote create (legacy CSV/Revit flow) not migrated; use new quote flow" },
    { status: 501 }
  );
}

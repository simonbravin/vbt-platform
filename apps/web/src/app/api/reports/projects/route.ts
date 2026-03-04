import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATUS_VALUES = ["QUOTED", "IN_CONVERSATION", "SOLD", "ARCHIVED"] as const;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 500);
  const status = url.searchParams.get("status") ?? "";
  const countryId = url.searchParams.get("countryId") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const soldFrom = url.searchParams.get("soldFrom") ?? "";
  const soldTo = url.searchParams.get("soldTo") ?? "";
  const search = url.searchParams.get("search") ?? "";

  const where: Record<string, unknown> = { orgId: user.orgId };

  if (status && STATUS_VALUES.includes(status as any)) {
    where.status = status;
  }

  if (countryId) {
    where.countryId = countryId;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  if (soldFrom || soldTo) {
    where.soldAt = {};
    if (soldFrom) (where.soldAt as Record<string, Date>).gte = new Date(soldFrom);
    if (soldTo) {
      const d = new Date(soldTo);
      d.setHours(23, 59, 59, 999);
      (where.soldAt as Record<string, Date>).lte = d;
    }
  }

  if (search.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" as const } },
      { client: { contains: search.trim(), mode: "insensitive" as const } },
      { clientRecord: { name: { contains: search.trim(), mode: "insensitive" as const } } },
      { location: { contains: search.trim(), mode: "insensitive" as const } },
      { country: { name: { contains: search.trim(), mode: "insensitive" as const } } },
      { country: { code: { contains: search.trim(), mode: "insensitive" as const } } },
    ];
  }

  const [projects, total, totalQuoted, inProgress, soldCount, archivedCount, valueQuotedAgg, valueSoldAgg] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        clientRecord: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        baselineQuote: { select: { id: true, quoteNumber: true, fobUsd: true, landedDdpUsd: true } },
        _count: { select: { quotes: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.project.count({ where }),
    prisma.project.count({ where: { orgId: user.orgId, quotes: { some: {} } } }),
    prisma.project.count({
      where: { orgId: user.orgId, status: { in: ["QUOTED", "IN_CONVERSATION"] } },
    }),
    prisma.project.count({ where: { orgId: user.orgId, status: "SOLD" } }),
    prisma.project.count({ where: { orgId: user.orgId, status: "ARCHIVED" } }),
    prisma.project.findMany({
      where: { ...where, baselineQuoteId: { not: null } },
      include: { baselineQuote: { select: { fobUsd: true } } },
    }).then((rows) => rows.reduce((s, p) => s + (Number(p.baselineQuote?.fobUsd) || 0), 0)),
    prisma.project.aggregate({
      where: { ...where, status: "SOLD" },
      _sum: { finalAmountUsd: true },
    }).then((r) => r._sum.finalAmountUsd ?? 0),
  ]);

  const closedCount = soldCount + archivedCount;
  const conversionRate = closedCount > 0 ? (soldCount / closedCount) * 100 : 0;

  return NextResponse.json({
    projects,
    total,
    page,
    limit,
    summary: {
      totalQuoted: totalQuoted,
      inProgress,
      sold: soldCount,
      archived: archivedCount,
      conversionRate: Math.round(conversionRate * 10) / 10,
      totalValueQuoted: valueQuotedAgg,
      totalValueSold: valueSoldAgg,
    },
  });
}

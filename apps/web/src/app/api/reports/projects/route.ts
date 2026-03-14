import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getCountryName } from "@/lib/countries";
import type { SessionUser } from "@/lib/auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 10000;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser & { activeOrgId?: string | null };
  const organizationId = await getEffectiveActiveOrgId(user);
  if (!organizationId) {
    return NextResponse.json({
      projects: [],
      total: 0,
      page: 1,
      limit: DEFAULT_LIMIT,
      summary: {
        totalQuoted: 0,
        inProgress: 0,
        sold: 0,
        archived: 0,
        conversionRate: 0,
        totalValueQuoted: 0,
        totalValueSold: 0,
      },
    });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
  const status = url.searchParams.get("status") ?? "";
  const countryCode = url.searchParams.get("countryCode") ?? url.searchParams.get("countryId") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim();
  const soldFrom = url.searchParams.get("soldFrom") ?? "";
  const soldTo = url.searchParams.get("soldTo") ?? "";
  const format = (url.searchParams.get("format") ?? "").toLowerCase();

  const where: Record<string, unknown> = { organizationId };
  if (status) {
    const statusMap: Record<string, string> = {
      DRAFT: "lead",
      QUOTED: "quoting",
      QUOTE_SENT: "quoting",
      SOLD: "won",
      ARCHIVED: "lost",
      lead: "lead",
      qualified: "qualified",
      quoting: "quoting",
      engineering: "engineering",
      won: "won",
      lost: "lost",
      on_hold: "on_hold",
    };
    const prismaStatus = statusMap[status] ?? status;
    where.status = prismaStatus;
  }
  if (countryCode) where.countryCode = countryCode;
  if (clientId) where.clientId = clientId;
  if (search) {
    where.OR = [
      { projectName: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
      { city: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  if (soldFrom || soldTo) {
    (where as any).status = "won";
    (where as any).quotes = {
      some: {
        status: "accepted",
        updatedAt: {
          ...(soldFrom ? { gte: new Date(soldFrom) } : {}),
          ...(soldTo ? { lte: new Date(soldTo + "T23:59:59.999Z") } : {}),
        },
      },
    };
  }

  const [projects, total, summaryAgg] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        quotes: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          where: { status: "accepted" },
          select: { id: true, quoteNumber: true, totalPrice: true, status: true, updatedAt: true },
        },
        _count: { select: { quotes: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
    prisma.project.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    }),
  ]);

  const [totalValueQuotedAgg, totalValueSoldAgg] = await Promise.all([
    prisma.quote.aggregate({
      where: { project: where },
      _sum: { totalPrice: true },
    }),
    prisma.quote.aggregate({
      where: { project: where, status: "accepted" },
      _sum: { totalPrice: true },
    }),
  ]);
  const totalValueQuoted = totalValueQuotedAgg._sum.totalPrice ?? 0;
  const totalValueSold = totalValueSoldAgg._sum.totalPrice ?? 0;

  const acceptedQuoteByProject = await prisma.quote.findMany({
    where: { organizationId, projectId: { in: projects.map((p) => p.id) }, status: "accepted" },
    select: { projectId: true, totalPrice: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const valueSoldByProject = new Map(acceptedQuoteByProject.map((q) => [q.projectId, { totalPrice: q.totalPrice ?? 0, updatedAt: q.updatedAt }]));

  const statusCounts = Object.fromEntries(summaryAgg.map((g) => [g.status, g._count.id]));
  const inProgress =
    (statusCounts.lead ?? 0) +
    (statusCounts.qualified ?? 0) +
    (statusCounts.quoting ?? 0) +
    (statusCounts.engineering ?? 0) +
    (statusCounts.on_hold ?? 0);
  const soldCount = statusCounts.won ?? 0;
  const archivedCount = statusCounts.lost ?? 0;
  const totalQuoted = await prisma.project.count({
    where: { organizationId, quotes: { some: {} } },
  });
  const closedCount = soldCount + archivedCount;
  const conversionRate = closedCount > 0 ? Math.round((soldCount / closedCount) * 100) : 0;

  const summary = {
    totalQuoted,
    inProgress,
    sold: soldCount,
    archived: archivedCount,
    conversionRate,
    totalValueQuoted,
    totalValueSold,
  };

  const rows = projects.map((p) => {
    const accepted = p.quotes[0] ?? valueSoldByProject.get(p.id);
    return {
      id: p.id,
      name: p.projectName,
      projectName: p.projectName,
      client: p.client?.name ?? null,
      clientRecord: p.client ? { id: p.client.id, name: p.client.name } : null,
      location: p.city ?? p.address ?? null,
      countryCode: p.countryCode ?? null,
      country: p.countryCode ? { id: p.countryCode, name: getCountryName(p.countryCode), code: p.countryCode } : null,
      status: p.status,
      baselineQuote: accepted
        ? {
            id: (p.quotes[0] as { id?: string })?.id,
            quoteNumber: (p.quotes[0] as { quoteNumber?: string })?.quoteNumber ?? null,
            fobUsd: (p.quotes[0] as { totalPrice?: number })?.totalPrice ?? (accepted as { totalPrice?: number })?.totalPrice ?? null,
          }
        : null,
      soldAt: (accepted as { updatedAt?: Date })?.updatedAt ?? (p.status === "won" ? (accepted as { updatedAt?: Date })?.updatedAt : null),
      finalAmountUsd: p.status === "won" && accepted ? ((accepted as { totalPrice?: number }).totalPrice ?? (accepted as { totalPrice?: number })?.totalPrice) : null,
      _count: p._count,
    };
  });

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const wsData = [
      ["Project", "Client", "Location", "Country", "Status", "Quote number", "FOB (USD)", "Sale date", "Final amount", "Quotes count"],
      ...rows.map((p) => [
        p.projectName,
        p.client ?? "",
        p.location ?? "",
        p.countryCode ?? "",
        p.status,
        (p.baselineQuote as { quoteNumber?: string })?.quoteNumber ?? "",
        (p.baselineQuote as { fobUsd?: number })?.fobUsd ?? "",
        p.soldAt ? new Date(p.soldAt).toLocaleDateString() : "",
        p.finalAmountUsd ?? "",
        p._count.quotes,
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `vbt-projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "csv") {
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["Project", "Client", "Location", "Country", "Status", "Quote number", "FOB (USD)", "Sale date", "Final amount", "Quotes count"];
    const csvRows = [
      headers.join(","),
      ...rows.map((p) =>
        [
          p.projectName,
          p.client ?? "",
          p.location ?? "",
          p.countryCode ?? "",
          p.status,
          (p.baselineQuote as { quoteNumber?: string })?.quoteNumber ?? "",
          (p.baselineQuote as { fobUsd?: number })?.fobUsd ?? "",
          p.soldAt ? new Date(p.soldAt).toLocaleDateString() : "",
          p.finalAmountUsd ?? "",
          p._count.quotes,
        ]
          .map(escape)
          .join(",")
      ),
    ];
    const csv = csvRows.join("\n");
    const filename = `vbt-projects-report-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({
    projects: rows,
    total,
    page,
    limit,
    summary,
  });
}

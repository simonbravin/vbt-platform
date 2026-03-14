import type { PrismaClient } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

function projectWhere(ctx: TenantContext, extra: Record<string, unknown> = {}) {
  const base = orgScopeWhere(ctx);
  if (Object.keys(base).length === 0) return extra;
  return { ...base, ...extra };
}

function quoteWhere(ctx: TenantContext, extra: Record<string, unknown> = {}) {
  const base = orgScopeWhere(ctx);
  if (Object.keys(base).length === 0) return extra;
  return { ...base, ...extra };
}

function activityWhere(ctx: TenantContext, extra: Record<string, unknown> = {}) {
  const base = orgScopeWhere(ctx);
  if (Object.keys(base).length === 0) return extra;
  return { ...base, ...extra };
}

export type PipelineAnalyticsResult = {
  projects_total: number;
  projects_by_status: Record<string, number>;
  quotes_total: number;
  quotes_by_status: Record<string, number>;
  quotes_value_pipeline: number;
  quotes_value_won: number;
  quotes_value_lost: number;
};

export async function getPipelineAnalytics(
  prisma: PrismaClient,
  ctx: TenantContext
): Promise<PipelineAnalyticsResult> {
  const pWhere = projectWhere(ctx);
  const qWhere = quoteWhere(ctx);

  const [projectsTotal, projectsByStatus, quotesTotal, quotesByStatus, pipelineValue, wonValue, lostValue] =
    await Promise.all([
      prisma.project.count({ where: pWhere }),
      prisma.project.groupBy({
        by: ["status"],
        where: pWhere,
        _count: { id: true },
      }),
      prisma.quote.count({ where: qWhere }),
      prisma.quote.groupBy({
        by: ["status"],
        where: qWhere,
        _count: { id: true },
      }),
      prisma.quote.aggregate({
        where: { ...qWhere, status: { in: ["draft", "sent"] } },
        _sum: { totalPrice: true },
      }),
      prisma.quote.aggregate({
        where: { ...qWhere, status: "accepted" },
        _sum: { totalPrice: true },
      }),
      prisma.quote.aggregate({
        where: { ...qWhere, status: { in: ["rejected", "expired"] } },
        _sum: { totalPrice: true },
      }),
    ]);

  const projects_by_status: Record<string, number> = {};
  for (const row of projectsByStatus) {
    projects_by_status[row.status] = row._count.id;
  }
  const quotes_by_status: Record<string, number> = {};
  for (const row of quotesByStatus) {
    quotes_by_status[row.status] = row._count.id;
  }

  return {
    projects_total: projectsTotal,
    projects_by_status,
    quotes_total: quotesTotal,
    quotes_by_status,
    quotes_value_pipeline: pipelineValue._sum.totalPrice ?? 0,
    quotes_value_won: wonValue._sum.totalPrice ?? 0,
    quotes_value_lost: lostValue._sum.totalPrice ?? 0,
  };
}

export type PartnerPerformanceFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  partnerId?: string;
  country?: string;
};

export type PartnerPerformanceResult = {
  projects_created: number;
  quotes_created: number;
  quotes_sent: number;
  quotes_accepted: number;
  conversion_rate: number;
  revenue_total: number;
};

export async function getPartnerPerformance(
  prisma: PrismaClient,
  ctx: TenantContext,
  filters: PartnerPerformanceFilters = {}
): Promise<PartnerPerformanceResult[]> {
  const orgWhere = orgScopeWhere(ctx);
  const dateFilter =
    filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        }
      : {};
  const orgFilter =
    filters.partnerId || Object.keys(orgWhere).length > 0
      ? { organizationId: filters.partnerId ?? (orgWhere as { organizationId?: string }).organizationId }
      : {};
  if (Object.keys(orgFilter).length === 0 && !ctx.isPlatformSuperadmin) {
    return [];
  }

  const projectWhereClause = { ...orgFilter, ...dateFilter };
  const quoteWhereClause = { ...orgFilter, ...dateFilter };

  let orgIds: string[];
  if (filters.partnerId) {
    orgIds = [filters.partnerId];
  } else if (Object.keys(orgFilter).length > 0 && (orgFilter as { organizationId?: string }).organizationId) {
    orgIds = [(orgFilter as { organizationId: string }).organizationId];
  } else if (ctx.isPlatformSuperadmin) {
    orgIds = await prisma.organization
      .findMany({
        where: filters.country ? { countryCode: filters.country, organizationType: { in: ["commercial_partner", "master_partner"] } } : { organizationType: { in: ["commercial_partner", "master_partner"] } },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));
  } else {
    return [];
  }

  if (orgIds.length === 0) return [];

  const results: PartnerPerformanceResult[] = [];
  for (const orgId of orgIds) {
    const [projects_created, quotes_created, quotes_sent, quotes_accepted, revenueRows] = await Promise.all([
      prisma.project.count({
        where: { organizationId: orgId, ...dateFilter },
      }),
      prisma.quote.count({
        where: { organizationId: orgId, ...dateFilter },
      }),
      prisma.quote.count({
        where: { organizationId: orgId, status: "sent", ...dateFilter },
      }),
      prisma.quote.count({
        where: { organizationId: orgId, status: "accepted", ...dateFilter },
      }),
      prisma.quote.aggregate({
        where: { organizationId: orgId, status: "accepted", ...dateFilter },
        _sum: { totalPrice: true },
      }),
    ]);
    const revenue_total = revenueRows._sum.totalPrice ?? 0;
    const sentTotal = quotes_sent + quotes_accepted;
    const conversion_rate = sentTotal > 0 ? quotes_accepted / sentTotal : 0;
    results.push({
      projects_created,
      quotes_created,
      quotes_sent,
      quotes_accepted,
      conversion_rate: Math.round(conversion_rate * 10000) / 100,
      revenue_total,
    });
  }
  return results;
}

export type QuoteAnalyticsResult = {
  quotes_created: number;
  quotes_sent: number;
  quotes_accepted: number;
  quotes_rejected: number;
  average_quote_value: number;
  conversion_rate: number;
  average_sales_cycle_days: number;
};

export async function getQuoteAnalytics(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: { dateFrom?: Date; dateTo?: Date } = {}
): Promise<QuoteAnalyticsResult> {
  const qWhere = quoteWhere(ctx);
  const dateFilter =
    options.dateFrom || options.dateTo
      ? {
          createdAt: {
            ...(options.dateFrom && { gte: options.dateFrom }),
            ...(options.dateTo && { lte: options.dateTo }),
          },
        }
      : {};
  const where = { ...qWhere, ...dateFilter };

  const [created, sent, accepted, rejected, avgValue, acceptedQuotes] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.count({ where: { ...where, status: "sent" } }),
    prisma.quote.count({ where: { ...where, status: "accepted" } }),
    prisma.quote.count({ where: { ...where, status: "rejected" } }),
    prisma.quote.aggregate({
      where: { ...where, totalPrice: { gt: 0 } },
      _avg: { totalPrice: true },
      _count: { id: true },
    }),
    prisma.quote.findMany({
      where: { ...where, status: "accepted" },
      select: { createdAt: true, updatedAt: true },
    }),
  ]);

  const totalQuotes = created + sent + accepted + rejected;
  const withValue = avgValue._count.id;
  const average_quote_value = withValue > 0 ? (avgValue._avg.totalPrice ?? 0) : 0;
  const sentTotal = sent + accepted;
  const conversion_rate = sentTotal > 0 ? Math.round((accepted / sentTotal) * 10000) / 100 : 0;

  let average_sales_cycle_days = 0;
  if (acceptedQuotes.length > 0) {
    const totalDays = acceptedQuotes.reduce(
      (sum, q) => sum + (q.updatedAt.getTime() - q.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      0
    );
    average_sales_cycle_days = Math.round((totalDays / acceptedQuotes.length) * 10) / 10;
  }

  return {
    quotes_created: created,
    quotes_sent: sent,
    quotes_accepted: accepted,
    quotes_rejected: rejected,
    average_quote_value,
    conversion_rate,
    average_sales_cycle_days,
  };
}

export type DashboardOverviewResult = {
  projects_total: number;
  quotes_total: number;
  quotes_pipeline_value: number;
  quotes_won_value: number;
};

export async function getDashboardOverview(
  prisma: PrismaClient,
  ctx: TenantContext
): Promise<DashboardOverviewResult> {
  const pipeline = await getPipelineAnalytics(prisma, ctx);
  return {
    projects_total: pipeline.projects_total,
    quotes_total: pipeline.quotes_total,
    quotes_pipeline_value: pipeline.quotes_value_pipeline,
    quotes_won_value: pipeline.quotes_value_won,
  };
}

export async function getRecentProjects(
  prisma: PrismaClient,
  ctx: TenantContext,
  limit = 10
) {
  const where = projectWhere(ctx);
  return prisma.project.findMany({
    where,
    select: {
      id: true,
      projectName: true,
      status: true,
      countryCode: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function getRecentQuotes(
  prisma: PrismaClient,
  ctx: TenantContext,
  limit = 10
) {
  const where = quoteWhere(ctx);
  return prisma.quote.findMany({
    where,
    select: {
      id: true,
      quoteNumber: true,
      version: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      project: { select: { id: true, projectName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function getDashboardActivity(
  prisma: PrismaClient,
  ctx: TenantContext,
  limit = 20
) {
  const where = activityWhere(ctx);
  return prisma.activityLog.findMany({
    where,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type LeaderboardEntry = {
  partnerId: string;
  partnerName: string;
  projects: number;
  quotes: number;
  quotes_accepted: number;
  revenue: number;
  conversionRate: number;
};

export type LeaderboardSort = "revenue" | "quotes_accepted";

export async function getPartnerLeaderboard(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: { sort?: LeaderboardSort; limit?: number; dateFrom?: Date; dateTo?: Date } = {}
): Promise<LeaderboardEntry[]> {
  const orgWhere = orgScopeWhere(ctx);
  const dateFilter =
    options.dateFrom || options.dateTo
      ? {
          createdAt: {
            ...(options.dateFrom && { gte: options.dateFrom }),
            ...(options.dateTo && { lte: options.dateTo }),
          },
        }
      : {};
  const limit = options.limit ?? 20;

  const partnerOrgs = await prisma.organization.findMany({
    where: {
      organizationType: { in: ["commercial_partner", "master_partner"] },
      ...(Object.keys(orgWhere).length > 0 ? orgWhere : {}),
    },
    select: { id: true, name: true },
  });

  const entries: LeaderboardEntry[] = [];
  for (const org of partnerOrgs) {
    const [projects, quotes, accepted, revenueAgg] = await Promise.all([
      prisma.project.count({
        where: { organizationId: org.id, ...dateFilter },
      }),
      prisma.quote.count({
        where: { organizationId: org.id, ...dateFilter },
      }),
      prisma.quote.count({
        where: { organizationId: org.id, status: "accepted", ...dateFilter },
      }),
      prisma.quote.aggregate({
        where: { organizationId: org.id, status: "accepted", ...dateFilter },
        _sum: { totalPrice: true },
      }),
    ]);
    const revenue = revenueAgg._sum.totalPrice ?? 0;
    const sent = await prisma.quote.count({
      where: { organizationId: org.id, status: "sent", ...dateFilter },
    });
    const conversionRate = sent + accepted > 0 ? Math.round((accepted / (sent + accepted)) * 10000) / 100 : 0;
    entries.push({
      partnerId: org.id,
      partnerName: org.name,
      projects,
      quotes,
      quotes_accepted: accepted,
      revenue,
      conversionRate,
    });
  }

  const sort = options.sort ?? "revenue";
  entries.sort((a, b) =>
    sort === "revenue" ? b.revenue - a.revenue : b.quotes_accepted - a.quotes_accepted
  );
  return entries.slice(0, limit);
}

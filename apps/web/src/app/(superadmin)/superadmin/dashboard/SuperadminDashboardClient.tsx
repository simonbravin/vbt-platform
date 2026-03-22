"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FileText, FolderOpen, TrendingUp, ArrowRight, Wrench } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

type Overview = {
  projects_total: number;
  quotes_total: number;
  quotes_pipeline_value: number;
  quotes_won_value: number;
  engineering_requests_total: number;
  engineering_by_status: Record<string, number>;
};

type LeaderboardEntry = {
  partnerId: string;
  partnerName: string;
  projects: number;
  quotes: number;
  quotes_accepted: number;
  revenue: number;
  conversionRate: number;
};

export function SuperadminDashboardClient() {
  const t = useT();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [overviewRes, leaderboardRes] = await Promise.all([
          fetch("/api/saas/dashboard/overview"),
          fetch("/api/saas/analytics/leaderboard?limit=10"),
        ]);
        if (!overviewRes.ok || !leaderboardRes.ok) {
          setError(t("superadmin.dashboard.failedToLoad"));
          return;
        }
        const [overviewJson, leaderboardJson] = await Promise.all([
          overviewRes.json(),
          leaderboardRes.json(),
        ]);
        if (!cancelled) {
          setOverview(overviewJson);
          setLeaderboard(Array.isArray(leaderboardJson) ? leaderboardJson : leaderboardJson?.entries ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(t("superadmin.dashboard.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-sm bg-muted animate-pulse" />
        ))}
        <div className="lg:col-span-2 h-64 rounded-sm bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        <p className="font-medium">{error}</p>
        <p className="text-sm mt-1 text-muted-foreground">{t("superadmin.dashboard.checkSuperadmin")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.dashboard.totalProjects")}</p>
              <p className="text-2xl font-semibold text-foreground">
                {overview?.projects_total ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.dashboard.totalQuotes")}</p>
              <p className="text-2xl font-semibold text-foreground">
                {overview?.quotes_total ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.dashboard.pipelineValue")}</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(overview?.quotes_pipeline_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.dashboard.wonValue")}</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(overview?.quotes_won_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.dashboard.engineeringRequests")}</p>
              <p className="text-2xl font-semibold text-foreground">{overview?.engineering_requests_total ?? 0}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("superadmin.dashboard.engineeringByStatus")}
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                {Object.keys(overview?.engineering_by_status ?? {}).length === 0 ? (
                  <li className="text-muted-foreground">—</li>
                ) : (
                  Object.entries(overview!.engineering_by_status)
                    .sort((a, b) => b[1] - a[1])
                    .map(([st, n]) => (
                      <li key={st}>
                        <span className="text-muted-foreground">{t(`partner.engineering.status.${st}`)}:</span> {n}
                      </li>
                    ))
                )}
              </ul>
            </div>
          </div>
          <Link
            href="/superadmin/engineering"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
          >
            {t("superadmin.dashboard.viewEngineering")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.dashboard.partnerLeaderboard")}</h2>
          <Link
            href="/superadmin/analytics"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            {t("superadmin.dashboard.viewAnalytics")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("superadmin.dashboard.partner")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("superadmin.dashboard.projects")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("superadmin.dashboard.quotes")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("superadmin.dashboard.won")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("superadmin.dashboard.revenue")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("superadmin.dashboard.conversion")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {t("superadmin.dashboard.noPartnerDataYet")}
                  </td>
                </tr>
              ) : (
                leaderboard.map((row) => (
                  <tr key={row.partnerId} className="hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/superadmin/partners/${row.partnerId}`}
                        className="font-medium text-foreground hover:text-primary flex items-center gap-2"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {row.partnerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {row.projects}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {row.quotes}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {row.quotes_accepted}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                      {formatCurrency(row.revenue ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {row.conversionRate != null
                        ? `${Number(row.conversionRate).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

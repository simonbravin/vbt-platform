"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import {
  BarChart3,
  Building2,
  FileText,
  FolderOpen,
  TrendingUp,
  Download,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Pipeline = {
  projects_total: number;
  projects_by_status: Record<string, number>;
  quotes_total: number;
  quotes_by_status: Record<string, number>;
  quotes_value_pipeline: number;
  quotes_value_won: number;
  quotes_value_lost: number;
};

type Overview = {
  projects_total: number;
  quotes_total: number;
  quotes_pipeline_value: number;
  quotes_won_value: number;
  engineering_requests_total?: number;
  engineering_by_status?: Record<string, number>;
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

export function GlobalReportsClient() {
  const t = useT();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        const q = params.toString();
        const [overviewRes, pipelineRes, leaderboardRes] = await Promise.all([
          fetch("/api/saas/dashboard/overview"),
          fetch(`/api/saas/analytics/pipeline${q ? `?${q}` : ""}`),
          fetch(`/api/saas/analytics/leaderboard?limit=50&sort=revenue${q ? `&${q}` : ""}`),
        ]);
        if (!overviewRes.ok || !pipelineRes.ok || !leaderboardRes.ok) {
          setError(t("superadmin.reports.failedToLoad"));
          return;
        }
        const [overviewJson, pipelineJson, leaderboardJson] = await Promise.all([
          overviewRes.json(),
          pipelineRes.json(),
          leaderboardRes.json(),
        ]);
        if (!cancelled) {
          setOverview(overviewJson);
          setPipeline(pipelineJson);
          setLeaderboard(Array.isArray(leaderboardJson) ? leaderboardJson : leaderboardJson?.entries ?? []);
        }
      } catch {
        if (!cancelled) setError(t("superadmin.reports.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, t]);

  const exportUrl = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("type", "leaderboard");
    params.set("format", format);
    params.set("sort", "revenue");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `/api/saas/analytics/export?${params}`;
  };

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-sm bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-sm bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        <p className="font-medium">{error}</p>
        <p className="text-sm mt-1 text-muted-foreground">{t("superadmin.globalReports.errorHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Date filter */}
      <div className="surface-card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("superadmin.globalReports.dateFrom")}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("superadmin.globalReports.dateTo")}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.globalReports.kpiTotalProjects")}</p>
              <p className="text-2xl font-semibold text-foreground">{pipeline?.projects_total ?? overview?.projects_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.globalReports.kpiTotalQuotes")}</p>
              <p className="text-2xl font-semibold text-foreground">{pipeline?.quotes_total ?? overview?.quotes_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.globalReports.kpiPipelineValue")}</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(pipeline?.quotes_value_pipeline ?? overview?.quotes_pipeline_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.globalReports.kpiWonLost")}</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(pipeline?.quotes_value_won ?? overview?.quotes_won_value ?? 0)} /{" "}
                {formatCurrency(pipeline?.quotes_value_lost ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Partner leaderboard + Export */}
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">{t("superadmin.globalReports.leaderboardTitle")}</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportUrl("csv")}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" /> {t("superadmin.globalReports.exportCsv")}
            </a>
            <a
              href={exportUrl("xlsx")}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" /> {t("superadmin.globalReports.exportExcel")}
            </a>
            <Link
              href="/superadmin/analytics"
              className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("superadmin.globalReports.fullAnalytics")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.globalReports.colPartner")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.globalReports.colProjects")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.globalReports.colQuotes")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.globalReports.colWon")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.globalReports.colRevenue")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.globalReports.colConversion")}</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">{t("superadmin.globalReports.noPartnerData")}</td>
                </tr>
              ) : (
                leaderboard.map((row) => (
                  <tr key={row.partnerId} className="hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/superadmin/partners/${row.partnerId}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {row.partnerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right text-foreground">{row.projects}</td>
                    <td className="px-5 py-3 text-right text-foreground">{row.quotes}</td>
                    <td className="px-5 py-3 text-right text-foreground">{row.quotes_accepted}</td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">{formatCurrency(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{row.conversionRate}%</td>
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

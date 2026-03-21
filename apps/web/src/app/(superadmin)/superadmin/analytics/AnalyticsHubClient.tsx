"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Building2, FileText, TrendingUp, BarChart3, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

type Pipeline = {
  projects_total: number;
  projects_by_status: Record<string, number>;
  quotes_total: number;
  quotes_by_status: Record<string, number>;
  quotes_value_pipeline: number;
  quotes_value_won: number;
  quotes_value_lost: number;
};

type PartnerPerf = {
  projects_created: number;
  quotes_created: number;
  quotes_sent: number;
  quotes_accepted: number;
  conversion_rate: number;
  revenue_total: number;
};

type QuoteAnalytics = {
  quotes_created: number;
  quotes_sent: number;
  quotes_accepted: number;
  quotes_rejected: number;
  quotes_archived: number;
  average_quote_value: number;
  conversion_rate: number;
  average_sales_cycle_days: number;
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

type PartnerOption = { id: string; name: string };

function buildQuery(params: { dateFrom?: string; dateTo?: string; partnerId?: string; country?: string }) {
  const sp = new URLSearchParams();
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.partnerId) sp.set("partnerId", params.partnerId);
  if (params.country) sp.set("country", params.country);
  return sp.toString();
}

export function AnalyticsHubClient() {
  const t = useT();
  const projectStatusLabels = useMemo(
    () => ({
      lead: t("superadmin.analytics.projectStatus.lead"),
      qualified: t("superadmin.analytics.projectStatus.qualified"),
      quoting: t("superadmin.analytics.projectStatus.quoting"),
      engineering: t("superadmin.analytics.projectStatus.engineering"),
      won: t("superadmin.analytics.projectStatus.won"),
      lost: t("superadmin.analytics.projectStatus.lost"),
      on_hold: t("superadmin.analytics.projectStatus.on_hold"),
      draft: t("superadmin.analytics.projectStatus.draft"),
    }),
    [t]
  );
  const quoteStatusLabels = useMemo(
    () => ({
      draft: t("superadmin.analytics.quoteStatus.draft"),
      sent: t("superadmin.analytics.quoteStatus.sent"),
      accepted: t("superadmin.analytics.quoteStatus.accepted"),
      rejected: t("superadmin.analytics.quoteStatus.rejected"),
      expired: t("superadmin.analytics.quoteStatus.expired"),
      archived: t("superadmin.analytics.quoteStatus.archived"),
    }),
    [t]
  );
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    partnerId: "",
    country: "",
  });
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [partnerPerf, setPartnerPerf] = useState<PartnerPerf[]>([]);
  const [quoteAnalytics, setQuoteAnalytics] = useState<QuoteAnalytics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<"revenue" | "quotes_accepted">("revenue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    const res = await fetch("/api/saas/partners?limit=200");
    if (!res.ok) return;
    const data = await res.json();
    setPartners(data.partners?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) ?? []);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = buildQuery({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      partnerId: filters.partnerId || undefined,
      country: filters.country || undefined,
    });
    const leaderboardParams = new URLSearchParams();
    if (filters.dateFrom) leaderboardParams.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) leaderboardParams.set("dateTo", filters.dateTo);
    leaderboardParams.set("sort", leaderboardSort);
    leaderboardParams.set("limit", "50");

    try {
      const [pipeRes, perfRes, quotesRes, leadRes] = await Promise.all([
        fetch(`/api/saas/analytics/pipeline${q ? `?${q}` : ""}`),
        fetch(`/api/saas/analytics/partners${q ? `?${q}` : ""}`),
        fetch(`/api/saas/analytics/quotes${q ? `?${q}` : ""}`),
        fetch(`/api/saas/analytics/leaderboard?${leaderboardParams}`),
      ]);

      if (!pipeRes.ok || !perfRes.ok || !quotesRes.ok || !leadRes.ok) {
        setError(t("superadmin.analytics.failedToLoad"));
        return;
      }

      const [pipeJson, perfJson, quotesJson, leadJson] = await Promise.all([
        pipeRes.json(),
        perfRes.json(),
        quotesRes.json(),
        leadRes.json(),
      ]);

      setPipeline(pipeJson);
      setPartnerPerf(Array.isArray(perfJson) ? perfJson : []);
      setQuoteAnalytics(quotesJson);
      setLeaderboard(Array.isArray(leadJson) ? leadJson : leadJson?.entries ?? []);
    } catch {
      setError(t("superadmin.analytics.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo, filters.partnerId, filters.country, leaderboardSort, t]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  if (loading && !pipeline) {
    return (
      <div className="space-y-6">
        <div className="h-12 rounded-lg bg-muted animate-pulse w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("superadmin.analytics.filterDateFrom")}</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("superadmin.analytics.filterDateTo")}</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("superadmin.analytics.filterPartner")}</label>
          <select
            value={filters.partnerId}
            onChange={(e) => setFilters((f) => ({ ...f, partnerId: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground min-w-[180px]"
          >
            <option value="">{t("superadmin.analytics.allPartners")}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("superadmin.analytics.filterCountry")}</label>
          <input
            type="text"
            placeholder={t("superadmin.analytics.filterCountryPlaceholder")}
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value.trim() }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground w-24"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("superadmin.analytics.applyFilters")}
        </button>
      </form>

      {/* Pipeline */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.analytics.pipelineSection")}</h2>
        </div>
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.analytics.metricProjects")}</p>
              <p className="text-2xl font-semibold text-foreground">{pipeline?.projects_total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.analytics.metricQuotes")}</p>
              <p className="text-2xl font-semibold text-foreground">{pipeline?.quotes_total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.analytics.pipelineValue")}</p>
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(pipeline?.quotes_value_pipeline ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.analytics.wonLost")}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(pipeline?.quotes_value_won ?? 0)} / {formatCurrency(pipeline?.quotes_value_lost ?? 0)}
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">{t("superadmin.analytics.projectsByStatus")}</h3>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(pipeline?.projects_by_status ?? {}).length === 0 ? (
                  <li className="text-muted-foreground">{t("superadmin.analytics.noData")}</li>
                ) : (
                  Object.entries(pipeline?.projects_by_status ?? {}).map(([status, count]) => (
                    <li key={status} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {projectStatusLabels[status as keyof typeof projectStatusLabels] ?? status}
                      </span>
                      <span className="font-medium text-foreground">{count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">{t("superadmin.analytics.quotesByStatus")}</h3>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(pipeline?.quotes_by_status ?? {}).length === 0 ? (
                  <li className="text-muted-foreground">{t("superadmin.analytics.noData")}</li>
                ) : (
                  Object.entries(pipeline?.quotes_by_status ?? {}).map(([status, count]) => (
                    <li key={status} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {quoteStatusLabels[status as keyof typeof quoteStatusLabels] ?? status}
                      </span>
                      <span className="font-medium text-foreground">{count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quote analytics */}
      {quoteAnalytics && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">{t("superadmin.analytics.quoteAnalyticsSection")}</h2>
          </div>
          <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("superadmin.analytics.quoteFlowCounts")}</p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {quoteAnalytics.quotes_created} / {quoteAnalytics.quotes_sent} / {quoteAnalytics.quotes_accepted} / {quoteAnalytics.quotes_rejected} / {quoteAnalytics.quotes_archived ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("superadmin.analytics.conversionRate")}</p>
              <p className="text-lg font-semibold text-foreground mt-1">{quoteAnalytics.conversion_rate}%</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("superadmin.analytics.avgQuoteValue")}</p>
              <p className="text-lg font-semibold text-foreground mt-1">{formatCurrency(quoteAnalytics.average_quote_value)}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("superadmin.analytics.avgSalesCycleDays")}</p>
              <p className="text-lg font-semibold text-foreground mt-1">{quoteAnalytics.average_sales_cycle_days}</p>
            </div>
          </div>
        </div>
      )}

      {/* Partner performance (when filtered by partner or superadmin sees all) */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.analytics.partnerPerformance")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colPartner")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colProjects")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colQuotes")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colSent")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colAccepted")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colConversion")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colRevenue")}</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {partnerPerf.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {t("superadmin.analytics.emptyPartnerPerf")}
                  </td>
                </tr>
              ) : (
                partnerPerf.map((row, idx) => {
                  const partnerName = filters.partnerId && partnerPerf.length === 1
                    ? partners.find((p) => p.id === filters.partnerId)?.name ?? filters.partnerId
                    : null;
                  return (
                  <tr key={idx} className="hover:bg-muted/50">
                    <td className="px-5 py-3 text-sm text-foreground">{partnerName ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.projects_created}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.quotes_created}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.quotes_sent}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.quotes_accepted}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.conversion_rate}%</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-foreground">{formatCurrency(row.revenue_total)}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-xs text-muted-foreground border-t border-border">{t("superadmin.analytics.partnerPerfHint")}</p>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.analytics.leaderboardSection")}</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              onClick={() => setLeaderboardSort("revenue")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${leaderboardSort === "revenue" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"}`}
            >
              {t("superadmin.analytics.sortByRevenue")}
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardSort("quotes_accepted")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${leaderboardSort === "quotes_accepted" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"}`}
            >
              {t("superadmin.analytics.sortByQuotesAccepted")}
            </button>
            <span className="text-muted-foreground mx-1">|</span>
            <a
              href={`/api/saas/analytics/export?type=leaderboard&format=csv&sort=${leaderboardSort}${filters.dateFrom ? `&dateFrom=${filters.dateFrom}` : ""}${filters.dateTo ? `&dateTo=${filters.dateTo}` : ""}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium border border-border text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" /> {t("superadmin.analytics.exportCsv")}
            </a>
            <a
              href={`/api/saas/analytics/export?type=leaderboard&format=xlsx&sort=${leaderboardSort}${filters.dateFrom ? `&dateFrom=${filters.dateFrom}` : ""}${filters.dateTo ? `&dateTo=${filters.dateTo}` : ""}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium border border-border text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" /> {t("superadmin.analytics.exportExcel")}
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colPartner")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colProjects")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colQuotes")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colWon")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colRevenue")}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.analytics.colConversion")}</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">{t("superadmin.analytics.emptyLeaderboard")}</td>
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
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.projects}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.quotes}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{row.quotes_accepted}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-foreground">{formatCurrency(row.revenue ?? 0)}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {row.conversionRate != null ? `${Number(row.conversionRate).toFixed(1)}%` : "—"}
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

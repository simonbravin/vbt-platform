"use client";

import { useEffect, useState, useCallback } from "react";
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

const PROJECT_STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  quoting: "Quoting",
  engineering: "Engineering",
  won: "Won",
  lost: "Lost",
  on_hold: "On hold",
  draft: "Draft",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

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
        <div className="h-12 rounded-lg bg-gray-200 animate-pulse w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Partner</label>
          <select
            value={filters.partnerId}
            onChange={(e) => setFilters((f) => ({ ...f, partnerId: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">All partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
          <input
            type="text"
            placeholder="e.g. US, MX"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value.trim() }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-24"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90"
        >
          Apply filters
        </button>
      </form>

      {/* Pipeline */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Pipeline</h2>
        </div>
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-sm font-medium text-gray-500">Projects</p>
              <p className="text-2xl font-semibold text-gray-900">{pipeline?.projects_total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-sm font-medium text-gray-500">Quotes</p>
              <p className="text-2xl font-semibold text-gray-900">{pipeline?.quotes_total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-amber-50/50 p-4">
              <p className="text-sm font-medium text-gray-500">Pipeline value</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(pipeline?.quotes_value_pipeline ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-emerald-50/50 p-4">
              <p className="text-sm font-medium text-gray-500">Won / Lost</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatCurrency(pipeline?.quotes_value_won ?? 0)} / {formatCurrency(pipeline?.quotes_value_lost ?? 0)}
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Projects by status</h3>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(pipeline?.projects_by_status ?? {}).length === 0 ? (
                  <li className="text-gray-500">No data</li>
                ) : (
                  Object.entries(pipeline?.projects_by_status ?? {}).map(([status, count]) => (
                    <li key={status} className="flex justify-between">
                      <span className="text-gray-600">{PROJECT_STATUS_LABELS[status] ?? status}</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Quotes by status</h3>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(pipeline?.quotes_by_status ?? {}).length === 0 ? (
                  <li className="text-gray-500">No data</li>
                ) : (
                  Object.entries(pipeline?.quotes_by_status ?? {}).map(([status, count]) => (
                    <li key={status} className="flex justify-between">
                      <span className="text-gray-600">{QUOTE_STATUS_LABELS[status] ?? status}</span>
                      <span className="font-medium text-gray-900">{count}</span>
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Quote analytics</h2>
          </div>
          <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">Created / Sent / Accepted / Rejected</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {quoteAnalytics.quotes_created} / {quoteAnalytics.quotes_sent} / {quoteAnalytics.quotes_accepted} / {quoteAnalytics.quotes_rejected}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">Conversion rate</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{quoteAnalytics.conversion_rate}%</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">Avg quote value</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(quoteAnalytics.average_quote_value)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500">Avg sales cycle (days)</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{quoteAnalytics.average_sales_cycle_days}</p>
            </div>
          </div>
        </div>
      )}

      {/* Partner performance (when filtered by partner or superadmin sees all) */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Partner performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quotes</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accepted</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {partnerPerf.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                    No partner performance data (apply a partner filter or ensure partners exist).
                  </td>
                </tr>
              ) : (
                partnerPerf.map((row, idx) => {
                  const partnerName = filters.partnerId && partnerPerf.length === 1
                    ? partners.find((p) => p.id === filters.partnerId)?.name ?? filters.partnerId
                    : null;
                  return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-600">{partnerName ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.projects_created}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.quotes_created}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.quotes_sent}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.quotes_accepted}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.conversion_rate}%</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(row.revenue_total)}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100">
          Partner performance is shown per partner when &quot;All partners&quot; is selected; when a single partner is selected, one row is shown.
        </p>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Partner leaderboard</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              onClick={() => setLeaderboardSort("revenue")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${leaderboardSort === "revenue" ? "bg-vbt-blue text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              By revenue
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardSort("quotes_accepted")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${leaderboardSort === "quotes_accepted" ? "bg-vbt-blue text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              By quotes accepted
            </button>
            <span className="text-gray-300 mx-1">|</span>
            <a
              href={`/api/saas/analytics/export?type=leaderboard&format=csv&sort=${leaderboardSort}${filters.dateFrom ? `&dateFrom=${filters.dateFrom}` : ""}${filters.dateTo ? `&dateTo=${filters.dateTo}` : ""}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <a
              href={`/api/saas/analytics/export?type=leaderboard&format=xlsx&sort=${leaderboardSort}${filters.dateFrom ? `&dateFrom=${filters.dateFrom}` : ""}${filters.dateTo ? `&dateTo=${filters.dateTo}` : ""}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export Excel
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quotes</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Won</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">No partner data yet</td>
                </tr>
              ) : (
                leaderboard.map((row) => (
                  <tr key={row.partnerId} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/superadmin/partners/${row.partnerId}`}
                        className="font-medium text-gray-900 hover:text-vbt-blue flex items-center gap-2"
                      >
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {row.partnerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.projects}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.quotes}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{row.quotes_accepted}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(row.revenue ?? 0)}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">
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

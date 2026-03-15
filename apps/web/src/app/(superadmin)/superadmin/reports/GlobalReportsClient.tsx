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
  }, [dateFrom, dateTo]);

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
            <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
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
        <p className="text-sm mt-1">Check that you are logged in as a platform superadmin. If the problem continues, try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Projects</p>
              <p className="text-2xl font-semibold text-gray-900">{pipeline?.projects_total ?? overview?.projects_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Quotes</p>
              <p className="text-2xl font-semibold text-gray-900">{pipeline?.quotes_total ?? overview?.quotes_total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pipeline Value</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(pipeline?.quotes_value_pipeline ?? overview?.quotes_pipeline_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Won / Lost</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(pipeline?.quotes_value_won ?? overview?.quotes_won_value ?? 0)} /{" "}
                {formatCurrency(pipeline?.quotes_value_lost ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Partner leaderboard + Export */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Partner leaderboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportUrl("csv")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <a
              href={exportUrl("xlsx")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export Excel
            </a>
            <Link
              href="/superadmin/analytics"
              className="inline-flex items-center gap-1.5 rounded-lg bg-vbt-blue px-3 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90"
            >
              Full Analytics <ArrowRight className="h-4 w-4" />
            </Link>
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
                        className="font-medium text-gray-900 hover:text-vbt-blue"
                      >
                        {row.partnerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">{row.projects}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{row.quotes}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{row.quotes_accepted}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.conversionRate}%</td>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FileText, FolderOpen, TrendingUp, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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

export function SuperadminDashboardClient() {
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
          setError("Failed to load dashboard data");
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
        if (!cancelled) setError("Failed to load dashboard data");
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
          <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
        ))}
        <div className="lg:col-span-2 h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">{error}</p>
        <p className="text-sm mt-1">Check that you are logged in as a platform superadmin. If the problem continues, try again later or contact support.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Projects</p>
              <p className="text-2xl font-semibold text-gray-900">
                {overview?.projects_total ?? 0}
              </p>
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
              <p className="text-2xl font-semibold text-gray-900">
                {overview?.quotes_total ?? 0}
              </p>
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
                {formatCurrency(overview?.quotes_pipeline_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Won Value</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(overview?.quotes_won_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Partner Leaderboard</h2>
          <Link
            href="/superadmin/analytics"
            className="text-sm font-medium text-vbt-blue hover:underline flex items-center gap-1"
          >
            View analytics <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotes
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Won
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversion
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">
                    No partner data yet
                  </td>
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
                    <td className="px-5 py-3 text-right text-sm text-gray-600">
                      {row.projects}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">
                      {row.quotes}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">
                      {row.quotes_accepted}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(row.revenue ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">
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

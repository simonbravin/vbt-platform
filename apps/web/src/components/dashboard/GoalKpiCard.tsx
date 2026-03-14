"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type GoalData = {
  salesTargetAnnualUsd: number | null;
  salesTargetAnnualM2: number | null;
  ytdSales: number;
};

export function GoalKpiCard() {
  const [data, setData] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saas/dashboard/goal")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d as GoalData);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-gray-500 text-sm">Sales goal (YTD)</span>
        </div>
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  const target = data?.salesTargetAnnualUsd ?? 0;
  const ytd = data?.ytdSales ?? 0;
  const hasTarget = target > 0;
  const percent = hasTarget ? Math.min(100, (ytd / target) * 100) : 0;
  const exceeded = hasTarget && ytd >= target;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Target className="w-5 h-5 text-indigo-600" />
        </div>
        <span className="text-gray-500 text-sm font-medium">Sales goal (YTD)</span>
      </div>
      {!hasTarget ? (
        <>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(ytd)}</p>
          <p className="text-gray-500 text-sm mt-0.5">No annual target set</p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(ytd)} <span className="text-gray-400 font-normal text-lg">/ {formatCurrency(target)}</span>
          </p>
          <div className="mt-2 h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${exceeded ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {exceeded ? "Target reached" : `${percent.toFixed(0)}% of annual target`}
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

type GoalData = {
  salesTargetAnnualUsd: number | null;
  salesTargetAnnualM2: number | null;
  ytdSales: number;
};

export function GoalKpiCard() {
  const t = useT();
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
      <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <span className="text-muted-foreground text-sm">{t("dashboard.goalTitle")}</span>
        </div>
        <div className="h-8 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  const target = data?.salesTargetAnnualUsd ?? 0;
  const ytd = data?.ytdSales ?? 0;
  const hasTarget = target > 0;
  const percent = hasTarget ? Math.min(100, (ytd / target) * 100) : 0;
  const exceeded = hasTarget && ytd >= target;

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
          <Target className="w-5 h-5 text-primary" />
        </div>
        <span className="text-muted-foreground text-sm font-medium">{t("dashboard.goalTitle")}</span>
      </div>
      {!hasTarget ? (
        <>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(ytd)}</p>
          <p className="text-muted-foreground text-sm mt-0.5">{t("dashboard.goalNoTarget")}</p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(ytd)} <span className="text-muted-foreground font-normal text-lg">/ {formatCurrency(target)}</span>
          </p>
          <div className="mt-2 h-2.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${exceeded ? "bg-primary" : "bg-vbt-orange"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {exceeded ? t("dashboard.goalReached") : t("dashboard.goalProgress", { percent: percent.toFixed(0) })}
          </p>
        </>
      )}
    </div>
  );
}

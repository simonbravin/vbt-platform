"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Download } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type ActivityItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; fullName: string | null } | null;
};

function formatActivityAction(
  t: (key: string, vars?: Record<string, string | number>) => string,
  action: string
): string {
  const lookupKey = `superadmin.activity.action.${action.toLowerCase()}`;
  const translated = t(lookupKey);
  if (translated === lookupKey) {
    return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return translated;
}

function formatActivityEntityType(
  t: (key: string, vars?: Record<string, string | number>) => string,
  entityType: string
): string {
  const norm = entityType.trim().replace(/\s+/g, "_").toLowerCase();
  const lookupKey = `superadmin.activity.entity.${norm}`;
  const translated = t(lookupKey);
  if (translated === lookupKey) {
    return entityType;
  }
  return translated;
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ActivityFeedClient() {
  const { locale, t } = useLanguage();
  const dateLocale = locale === "es" ? "es" : "en";
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState(() => isoDateDaysAgo(90));
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (exportFrom.trim()) params.set("from", `${exportFrom.trim()}T00:00:00.000Z`);
    if (exportTo.trim()) params.set("to", `${exportTo.trim()}T23:59:59.999Z`);
    const q = params.toString();
    return q ? `/api/saas/dashboard/activity/export?${q}` : "/api/saas/dashboard/activity/export";
  }, [exportFrom, exportTo]);

  useEffect(() => {
    let cancelled = false;
    async function fetchActivity() {
      try {
        const res = await fetch("/api/saas/dashboard/activity?limit=50");
        if (!res.ok) {
          setError(t("superadmin.activity.failedToLoad"));
          return;
        }
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError(t("superadmin.activity.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchActivity();
    return () => { cancelled = true; };
  }, [t]);

  if (loading) {
    return (
      <div className="surface-card-overflow">
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-sm bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="surface-card-overflow">
      <div className="px-5 py-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.activity.recentActivity")}</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t("superadmin.activity.dateFrom")}</span>
            <input
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t("superadmin.activity.dateTo")}</span>
            <input
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
          >
            <Download className="h-4 w-4" />
            {t("superadmin.activity.exportCsv")}
          </a>
        </div>
      </div>
      <p className="px-5 py-2 text-xs text-muted-foreground border-b border-border">{t("superadmin.activity.exportHint")}</p>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">{t("superadmin.activity.noActivityYet")}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-5 py-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-foreground">{formatActivityAction(t, item.action)}</span>
              {item.entityType && (
                <span className="text-muted-foreground">
                  {formatActivityEntityType(t, item.entityType)}
                  {item.entityId ? ` ${item.entityId.slice(0, 8)}…` : ""}
                </span>
              )}
              {item.user?.fullName && (
                <span className="text-muted-foreground">
                  {t("superadmin.activity.byUser", { name: item.user.fullName })}
                </span>
              )}
              <span className="text-muted-foreground ml-auto">
                {new Date(item.createdAt).toLocaleString(dateLocale)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

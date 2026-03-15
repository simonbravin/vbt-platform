"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type ActivityItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; fullName: string | null } | null;
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityFeedClient() {
  const t = useT();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Activity className="h-5 w-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">{t("superadmin.activity.recentActivity")}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">{t("superadmin.activity.noActivityYet")}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-5 py-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-gray-900">{formatAction(item.action)}</span>
              {item.entityType && (
                <span className="text-gray-500">
                  {item.entityType}
                  {item.entityId ? ` ${item.entityId.slice(0, 8)}…` : ""}
                </span>
              )}
              {item.user?.fullName && (
                <span className="text-gray-500">by {item.user.fullName}</span>
              )}
              <span className="text-gray-400 ml-auto">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

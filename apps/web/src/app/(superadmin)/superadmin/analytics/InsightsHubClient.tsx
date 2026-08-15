"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { AnalyticsHubClient } from "./AnalyticsHubClient";
import { GlobalReportsClient } from "../reports/GlobalReportsClient";

type InsightsTab = "analytics" | "reports";

export function InsightsHubClient() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: InsightsTab = searchParams.get("tab") === "reports" ? "reports" : "analytics";

  function selectTab(next: InsightsTab) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "reports") params.set("tab", "reports");
    else params.delete("tab");
    const q = params.toString();
    router.replace(q ? `/superadmin/analytics?${q}` : "/superadmin/analytics", { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border/60" role="tablist" aria-label={t("nav.superadmin.analytics")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "analytics"}
          onClick={() => selectTab("analytics")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "analytics"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("superadmin.insights.tabAnalytics")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          onClick={() => selectTab("reports")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "reports"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("superadmin.insights.tabReports")}
        </button>
      </div>
      {tab === "analytics" ? <AnalyticsHubClient /> : <GlobalReportsClient />}
    </div>
  );
}

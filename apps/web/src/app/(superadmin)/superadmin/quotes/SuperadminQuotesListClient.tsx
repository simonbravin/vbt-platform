"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

type QuoteRow = {
  id: string;
  quoteNumber: string;
  status: string;
  totalPrice: number;
  factoryCostTotal?: number | null;
  visionLatamMarkupPct?: number | null;
  createdAt: string;
  organization?: { name: string } | null;
  project: {
    id: string;
    projectName: string;
    projectCode?: string | null;
    countryCode?: string | null;
    client?: { name: string } | null;
  };
};

const STATUS_KEYS: Record<string, string> = {
  draft: "quotes.draft",
  sent: "quotes.sent",
  accepted: "quotes.accepted",
  rejected: "quotes.rejected",
  expired: "quotes.expired",
};

export function SuperadminQuotesListClient() {
  const t = useT();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | "">("");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/saas/partners?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.partners && setPartners(d.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, []);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      if (organizationId) params.set("organizationId", organizationId);
      const res = await fetch(`/api/saas/quotes?${params}`);
      const data = await res.json().catch(() => ({}));
      setQuotes(data.quotes ?? []);
      setTotal(data.total ?? 0);
      setError(!res.ok || data.error ? (data.message ?? t("superadmin.quotesList.failedLoad")) : null);
    } catch {
      setQuotes([]);
      setTotal(0);
      setError(t("superadmin.quotesList.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, organizationId, t]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-foreground flex items-center justify-between gap-2 flex-wrap">
          <span>
            {error}
            {quotes.length === 0 && t("superadmin.quotesList.emptyListHint")}
          </span>
          <button
            type="button"
            onClick={() => fetchQuotes()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-amber-600 text-white hover:bg-amber-700"
          >
            {t("superadmin.quotesList.retry")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[180px]"
        >
          <option value="">{t("superadmin.quotesList.allCompanies")}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder={t("superadmin.quotesList.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchQuotes()}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[200px]"
        />
        <button
          type="button"
          onClick={() => fetchQuotes()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
        >
          {t("superadmin.quotesList.search")}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!statusFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          {t("superadmin.quotesList.all")}
        </button>
        {(["draft", "sent", "accepted", "rejected", "expired"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {t(STATUS_KEYS[s] ?? s)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.quotesList.loading")}</div>
        ) : quotes.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.quotesList.noQuotes")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter ? t("superadmin.quotesList.noMatchStatus", { status: statusFilter }) : t("superadmin.quotesList.noQuotesYet")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colPartner")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colQuote")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colProject")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colStatus")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colVlPct")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colTotal")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.quotesList.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {quotes.map((q) => {
                  const vlPct = Number(q.visionLatamMarkupPct ?? 0);
                  return (
                    <tr key={q.id} className="hover:bg-muted/50">
                      <td className="px-5 py-3 text-sm text-foreground">
                        {q.organization?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-foreground">
                        {q.quoteNumber}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {q.project?.projectName ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            q.status === "accepted"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : q.status === "rejected"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : q.status === "sent"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t(STATUS_KEYS[q.status] ?? q.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-foreground">
                        {vlPct}%
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-foreground">
                        {formatCurrency(q.totalPrice ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/superadmin/quotes/${q.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          {t("superadmin.quotesList.view")} <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && total > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("superadmin.quotesList.showingCount", { shown: quotes.length, total })}
        </p>
      )}
    </div>
  );
}

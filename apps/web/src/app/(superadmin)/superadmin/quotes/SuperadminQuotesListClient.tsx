"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, ChevronRight, LayoutGrid, List, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-superadmin-quotes-view";

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
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [view, setView] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });
  const [organizationId, setOrganizationId] = useState<string | "">("");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

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
      if (debouncedSearch) params.set("search", debouncedSearch);
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
  }, [statusFilter, debouncedSearch, organizationId, t]);

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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setDebouncedSearch(searchInput.trim())}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[200px]"
        />
        <button
          type="button"
          onClick={() => setDebouncedSearch(searchInput.trim())}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
        >
          {t("superadmin.quotesList.search")}
        </button>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setView("table")}
            title={t("projects.tableView")}
            className={`p-2 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            title={t("projects.cardView")}
            className={`p-2 transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
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
              {statusFilter || debouncedSearch || organizationId
                ? t("superadmin.quotesList.noMatchFilters")
                : t("superadmin.quotesList.noQuotesYet")}
            </p>
          </div>
        ) : view === "table" ? (
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
        ) : (
          <div className="grid gap-4 p-4 sm:p-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {quotes.map((q) => {
              const vlPct = Number(q.visionLatamMarkupPct ?? 0);
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/40">
                      <FileText className="h-5 w-5 text-vbt-orange" />
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
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
                  </div>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {q.organization?.name ?? "—"}
                  </p>
                  <p className="mt-1 font-semibold text-foreground">{q.quoteNumber}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{q.project?.projectName ?? "—"}</p>
                  {q.project?.client?.name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{q.project.client.name}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {t("superadmin.quotesList.colVlPct")} {vlPct}%
                    </span>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(q.totalPrice ?? 0)}</span>
                  </div>
                  <Link
                    href={`/superadmin/quotes/${q.id}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("superadmin.quotesList.view")} <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
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

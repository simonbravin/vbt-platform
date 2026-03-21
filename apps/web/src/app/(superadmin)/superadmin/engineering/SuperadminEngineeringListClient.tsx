"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, ChevronRight, Search, LayoutGrid, List } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const ENGINEERING_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "pending_info",
  "needs_info",
  "in_progress",
  "completed",
  "delivered",
  "rejected",
] as const;

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-superadmin-engineering-view";

type Row = {
  id: string;
  requestNumber: string;
  status: string;
  organization?: { id: string; name: string } | null;
  project?: { id: string; projectName: string; countryCode?: string | null } | null;
  createdAt: string;
};

export function SuperadminEngineeringListClient() {
  const t = useT();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | "">("");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [view, setView] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });

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

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (organizationId) params.set("organizationId", organizationId);
      const res = await fetch(`/api/saas/engineering?${params}`);
      const data = await res.json().catch(() => ({}));
      setRows(data.requests ?? []);
      setTotal(data.total ?? 0);
      setError(!res.ok || data.error ? (data.message ?? t("superadmin.engineeringList.failedLoad")) : null);
    } catch {
      setRows([]);
      setTotal(0);
      setError(t("superadmin.engineeringList.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, organizationId, t]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-foreground">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchList()}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            {t("superadmin.engineeringList.retry")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="min-w-[180px] rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("superadmin.engineeringList.allCompanies")}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder={t("superadmin.engineeringList.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setDebouncedSearch(searchInput.trim())}
          className="min-w-[200px] rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => setDebouncedSearch(searchInput.trim())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
        >
          <Search className="h-4 w-4" />
          {t("superadmin.engineeringList.search")}
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
          {t("superadmin.engineeringList.allStatuses")}
        </button>
        {ENGINEERING_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {t(`partner.engineering.status.${s}`)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.engineeringList.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.engineeringList.noRequests")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.engineeringList.noMatch")}</p>
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("superadmin.engineeringList.colCompany")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("superadmin.engineeringList.colRequest")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("superadmin.engineeringList.colProject")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("superadmin.engineeringList.colCountry")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("superadmin.engineeringList.colStatus")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("superadmin.engineeringList.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="px-5 py-3 text-sm text-foreground">{r.organization?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{r.requestNumber}</td>
                    <td className="px-5 py-3 text-sm text-foreground">{r.project?.projectName ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-foreground">{r.project?.countryCode ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {t(`partner.engineering.status.${r.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/superadmin/engineering/${r.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {t("superadmin.engineeringList.view")} <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Wrench className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t(`partner.engineering.status.${r.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.organization?.name ?? "—"}</p>
                <p className="mt-1 font-semibold text-foreground">{r.requestNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.project?.projectName ?? "—"}</p>
                <p className="mt-2 text-xs text-muted-foreground">{r.project?.countryCode ?? "—"}</p>
                <Link
                  href={`/superadmin/engineering/${r.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("superadmin.engineeringList.view")} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
      {!loading && total > 0 && (
        <p className="text-sm text-muted-foreground">{t("superadmin.engineeringList.showingCount", { shown: rows.length, total })}</p>
      )}
    </div>
  );
}

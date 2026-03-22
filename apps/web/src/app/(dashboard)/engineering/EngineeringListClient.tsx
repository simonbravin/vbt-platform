"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Wrench, FolderOpen, Search, LayoutGrid, List } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type RequestRow = {
  id: string;
  requestNumber: string;
  status: string;
  projectId: string;
  project?: { id: string; projectName: string };
  createdAt: string;
};

const STATUS_OPTIONS = ["draft", "submitted", "in_review", "pending_info", "needs_info", "in_progress", "completed", "delivered", "rejected"];

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-partner-engineering-view";

export function EngineeringListClient() {
  const t = useT();
  const [view, setView] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstFetch = useRef(true);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isFirstFetch.current) setLoading(true);
      else setSearching(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "50");
      try {
        const res = await fetch(`/api/saas/engineering?${params}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(t("partner.engineering.failedToLoad"));
          setRequests([]);
          setTotal(0);
          return;
        }
        const data = await res.json();
        setRequests(data.requests ?? []);
        setTotal(data.total ?? 0);
      } catch {
        if (!cancelled) {
          setError(t("partner.engineering.failedToLoad"));
          setRequests([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
          setLoading(false);
          isFirstFetch.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, debouncedSearch, t]);

  const runSearchNow = useCallback(() => {
    setDebouncedSearch(searchInput.trim());
  }, [searchInput]);

  const emptyWithFilters = !loading && requests.length === 0 && (statusFilter || debouncedSearch);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:flex-wrap sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-sm border border-input px-3 py-2 text-sm min-w-[140px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent"
          >
            <option value="">{t("partner.engineering.allStatuses")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`partner.engineering.status.${s}`)}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px] max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={t("partner.engineering.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearchNow()}
              className="w-full rounded-sm border border-border py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={runSearchNow}
            disabled={searching}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {searching ? t("partner.engineering.searching") : t("partner.engineering.search")}
          </button>
          <div className="flex overflow-hidden rounded-sm border border-border">
            <button
              type="button"
              onClick={() => setView("cards")}
              title={t("projects.cardView")}
              className={`p-2 transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              title={t("projects.tableView")}
              className={`p-2 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Link
          href="/engineering/new"
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("partner.engineering.newRequest")}
        </Link>
      </div>

      <div className="surface-card-overflow">
        {error && <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-4 text-sm text-foreground">{error}</div>}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-foreground">
              {emptyWithFilters ? t("partner.engineering.noMatchSearch") : t("partner.engineering.noRequests")}
            </p>
            {!emptyWithFilters && (
              <Link href="/engineering/new" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <Plus className="h-4 w-4" /> {t("partner.engineering.createOne")}
              </Link>
            )}
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("partner.engineering.request")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("partner.engineering.project")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("partner.engineering.status")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("engineering.list.colCreated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/engineering/${r.id}`} className="font-medium text-foreground hover:text-primary">
                        {r.requestNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      <Link href={`/projects/${r.projectId}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {r.project?.projectName ?? r.projectId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground">
                        {t(`partner.engineering.status.${r.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:p-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/engineering/${r.id}`}
                className="surface-card p-5 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t(`partner.engineering.status.${r.status}`)}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-foreground">{r.requestNumber}</p>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{r.project?.projectName ?? r.projectId.slice(0, 8)}</span>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
        {!loading && requests.length > 0 && (
          <p className="px-5 py-2 text-xs text-muted-foreground border-t border-border/60">
            {t("partner.engineering.listSummary", { shown: requests.length, total })}
          </p>
        )}
      </div>
    </div>
  );
}

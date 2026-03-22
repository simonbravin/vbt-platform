"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, ChevronRight, LayoutGrid, List, User, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-superadmin-projects-view";

type ProjectRow = {
  id: string;
  projectName: string;
  projectCode?: string | null;
  countryCode?: string | null;
  city?: string | null;
  status: string;
  organization?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  _count?: { quotes: number };
};

const PROJECT_STATUSES = ["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"] as const;

export function SuperadminProjectsListClient() {
  const t = useT();
  const projectStatusLabel = (code: string) => t(`partner.reports.status.${code}`);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
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
  const [countryCode, setCountryCode] = useState("");
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

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (organizationId) params.set("organizationId", organizationId);
      if (countryCode.trim()) params.set("countryCode", countryCode.trim());
      const res = await fetch(`/api/saas/projects?${params}`);
      const data = await res.json().catch(() => ({}));
      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
      setError(!res.ok || data.error ? (data.message ?? t("superadmin.projectsList.failedLoad")) : null);
    } catch {
      setProjects([]);
      setTotal(0);
      setError(t("superadmin.projectsList.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, organizationId, countryCode, t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-foreground flex items-center justify-between gap-2 flex-wrap">
          <span>
            {error}
            {projects.length === 0 && t("superadmin.projectsList.emptyListHint")}
          </span>
          <button
            type="button"
            onClick={() => fetchProjects()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-amber-600 text-white hover:bg-amber-700"
          >
            {t("superadmin.projectsList.retry")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[180px]"
        >
          <option value="">{t("superadmin.projectsList.allCompanies")}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("superadmin.projectsList.countryPlaceholder")}
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-32"
        />
        <input
          type="search"
          placeholder={t("superadmin.projectsList.searchPlaceholder")}
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
          {t("superadmin.projectsList.search")}
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
          {t("superadmin.projectsList.allStatuses")}
        </button>
        {PROJECT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {projectStatusLabel(s)}
          </button>
        ))}
      </div>

      <div className="surface-card-overflow">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.projectsList.loading")}</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.projectsList.noProjects")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter || debouncedSearch || organizationId || countryCode
                ? t("superadmin.projectsList.noMatchFilters")
                : t("superadmin.projectsList.noProjectsYet")}
            </p>
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colCompany")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colProject")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colClient")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colCountry")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colStatus")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colQuotes")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.projectsList.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <td className="px-5 py-3 text-sm text-foreground">
                      {p.organization?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-foreground">
                      {p.projectName}
                      {p.projectCode && (
                        <span className="ml-1 text-muted-foreground">({p.projectCode})</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {p.client?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {p.countryCode ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        {projectStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {p._count?.quotes ?? 0}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {t("superadmin.projectsList.view")} <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:p-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="surface-card p-5 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                    <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {projectStatusLabel(p.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {p.organization?.name ?? "—"}
                </p>
                <h3 className="mt-1 font-semibold text-foreground">
                  {p.projectName}
                  {p.projectCode && <span className="ml-1 text-sm font-normal text-muted-foreground">({p.projectCode})</span>}
                </h3>
                {p.client?.name && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.client.name}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{p.countryCode ?? "—"}</span>
                  {p.city ? <span className="truncate"> · {p.city}</span> : null}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {t("superadmin.projectsList.colQuotes")}: {p._count?.quotes ?? 0}
                  </span>
                  <Link
                    href={`/projects/${p.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("superadmin.projectsList.view")} <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!loading && total > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("superadmin.projectsList.showingCount", { shown: projects.length, total })}
        </p>
      )}
    </div>
  );
}

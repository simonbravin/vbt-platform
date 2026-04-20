"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FolderOpen, MapPin, User, Search } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ViewLayoutToggle } from "@/components/ui/view-layout-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-partner-projects-view";

const PROJECT_STATUSES = ["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"] as const;

type Project = {
  id: string;
  projectName: string;
  client?: { id: string; name: string } | null;
  city?: string | null;
  countryCode?: string | null;
  status?: string;
  estimatedTotalAreaM2?: number | null;
  estimatedWallAreaM2?: number | null;
  _count?: { quotes: number };
};

const statusLabel: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  quoting: "Quoting",
  engineering: "Engineering",
  won: "Won",
  lost: "Lost",
  on_hold: "On hold",
  DRAFT: "Draft",
  QUOTED: "Quoted",
  QUOTE_SENT: "Quote sent",
  SOLD: "Sold",
  ARCHIVED: "Archived",
};

export function ProjectsClient({ projects: initialProjects, total: initialTotal }: { projects: Project[]; total: number }) {
  const t = useT();
  const projectStatusLabel = (code: string) => t(`partner.reports.status.${code}`);
  const [view, setView] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const runSearch = useCallback(() => {
    setDebouncedSearch(search.trim());
  }, [search]);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (!debouncedSearch && !statusFilter) {
      setProjects(initialProjects);
      setTotal(initialTotal);
      return;
    }
    setSearching(true);
    const params = new URLSearchParams({ limit: "100" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    else params.set("includeArchived", "false");
    fetch(`/api/saas/projects?${params}`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : {};
          if (r.ok && Array.isArray(data.projects)) {
            setProjects(data.projects);
            setTotal(typeof data.total === "number" ? data.total : 0);
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setSearching(false));
  }, [debouncedSearch, statusFilter, initialProjects, initialTotal]);

  const displayName = (p: Project) => p.projectName ?? (p as any).name ?? "";
  const displayClient = (p: Project) => p.client?.name ?? (p as any).clientRecord?.name ?? (p as any).client ?? "";
  const quoteCount = (p: Project) => p._count?.quotes ?? 0;
  const areaM2 = (p: Project) => p.estimatedTotalAreaM2 ?? p.estimatedWallAreaM2 ?? 0;

  const hasActiveFilters = Boolean(debouncedSearch) || Boolean(statusFilter);

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("projects.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-9"
              aria-label={t("projects.searchPlaceholder")}
            />
          </div>
          <Button type="button" onClick={runSearch} disabled={searching} className="border border-primary/20 shrink-0">
            {searching ? t("projects.searching") : t("projects.search")}
          </Button>
          <ViewLayoutToggle view={view} onViewChange={setView} />
        </div>
        <div className="w-full overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          <div className="flex flex-wrap items-center gap-2 min-w-min">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${!statusFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {t("projects.filterAllStatuses")}
            </button>
            {PROJECT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {projectStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            {hasActiveFilters ? t("projects.noSearchResults") : t("projects.noProjects")}
          </p>
          {!hasActiveFilters && (
            <Link href="/projects/new" className="text-primary text-sm hover:underline mt-2 block">
              {t("projects.createFirstLink")}
            </Link>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="surface-card p-5 transition-colors hover:border-border"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  {p.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "won" ? "border border-primary/25 bg-primary/10 text-primary" :
                      p.status === "lost" ? "bg-muted text-foreground" :
                      p.status === "quoting" ? "bg-primary/10 text-primary" :
                      p.status === "qualified" ? "border border-border/80 bg-muted text-foreground" :
                      "bg-muted text-foreground"
                    }`}>{statusLabel[p.status] ?? p.status}</span>
                  )}
                  <span className="text-xs px-2 py-1 bg-muted text-foreground rounded-full">
                    {quoteCount(p)} quote{quoteCount(p) !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-foreground">{displayName(p)}</h3>
              {displayClient(p) && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                  <User className="w-3.5 h-3.5" />
                  {displayClient(p)}
                </div>
              )}
              {(p.city ?? p.countryCode) && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {[p.city, p.countryCode].filter(Boolean).join(", ")}
                </div>
              )}
              {(areaM2(p) > 0) && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  {t("projects.estArea")} {Number(areaM2(p)).toFixed(0)} m²
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface-card-overflow">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{t("projects.project")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{t("projects.client")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{t("projects.location")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{t("common.status")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{t("projects.areaM2")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{t("projects.quotes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{displayName(p)}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{displayClient(p) || <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3 text-foreground">{(p.city || p.countryCode) ? [p.city, p.countryCode].filter(Boolean).join(", ") : <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3">
                    {p.status ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === "won" ? "border border-primary/25 bg-primary/10 text-primary" :
                        p.status === "lost" ? "bg-muted text-foreground" :
                        p.status === "quoting" ? "bg-primary/10 text-primary" :
                        p.status === "qualified" ? "border border-border/80 bg-muted text-foreground" :
                        "bg-muted text-foreground"
                      }`}>{statusLabel[p.status] ?? p.status}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">{areaM2(p) > 0 ? Number(areaM2(p)).toFixed(0) : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 bg-muted text-foreground rounded-full">{quoteCount(p)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FolderOpen, MapPin, User, LayoutGrid, List, Search } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-partner-projects-view";

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
  const [view, setView] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(() => {
    const q = search.trim();
    if (!q) {
      setProjects(initialProjects);
      setTotal(initialTotal);
      return;
    }
    setSearching(true);
    fetch(`/api/saas/projects?search=${encodeURIComponent(q)}&limit=100`)
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
  }, [search.trim(), initialProjects, initialTotal]);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!search.trim()) {
        setProjects(initialProjects);
        setTotal(initialTotal);
        return;
      }
      setSearching(true);
      fetch(`/api/saas/projects?search=${encodeURIComponent(search.trim())}&limit=100`)
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
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, initialProjects, initialTotal]);

  const displayName = (p: Project) => p.projectName ?? (p as any).name ?? "";
  const displayClient = (p: Project) => p.client?.name ?? (p as any).clientRecord?.name ?? (p as any).client ?? "";
  const quoteCount = (p: Project) => p._count?.quotes ?? 0;
  const areaM2 = (p: Project) => p.estimatedTotalAreaM2 ?? p.estimatedWallAreaM2 ?? 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("projects.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {searching ? t("projects.searching") : t("projects.search")}
        </button>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("cards")}
            title={t("projects.cardView")}
            className={`p-2 transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("table")}
            title={t("projects.tableView")}
            className={`p-2 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-card rounded-xl p-12 text-center shadow-sm border border-border">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            {search.trim() ? t("projects.noSearchResults") : t("projects.noProjects")}
          </p>
          {!search.trim() && (
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
              className="bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  {p.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "won" ? "bg-green-100 text-green-700" :
                      p.status === "lost" ? "bg-muted text-foreground" :
                      p.status === "quoting" ? "bg-blue-100 text-blue-700" :
                      p.status === "qualified" ? "bg-amber-100 text-amber-700" :
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
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
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
            <tbody className="divide-y divide-gray-50">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-vbt-blue hover:underline">{displayName(p)}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{displayClient(p) || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-foreground">{(p.city || p.countryCode) ? [p.city, p.countryCode].filter(Boolean).join(", ") : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {p.status ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === "won" ? "bg-green-100 text-green-700" :
                        p.status === "lost" ? "bg-muted text-foreground" :
                        p.status === "quoting" ? "bg-blue-100 text-blue-700" :
                        p.status === "qualified" ? "bg-amber-100 text-amber-700" :
                        "bg-muted text-foreground"
                      }`}>{statusLabel[p.status] ?? p.status}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
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

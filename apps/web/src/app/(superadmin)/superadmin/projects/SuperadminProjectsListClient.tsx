"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/context";

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
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<string | "">("");
  const [countryCode, setCountryCode] = useState("");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

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
      if (search.trim()) params.set("search", search.trim());
      if (organizationId) params.set("organizationId", organizationId);
      if (countryCode.trim()) params.set("countryCode", countryCode.trim());
      const res = await fetch(`/api/saas/projects?${params}`);
      const data = await res.json().catch(() => ({}));
      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
      setError(!res.ok || data.error ? (data.message ?? "Failed to load projects") : null);
    } catch {
      setProjects([]);
      setTotal(0);
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, organizationId, countryCode]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-foreground flex items-center justify-between gap-2 flex-wrap">
          <span>
            {error}
            {projects.length === 0 && " Showing empty list."}
          </span>
          <button
            type="button"
            onClick={() => fetchProjects()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-amber-600 text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[180px]"
        >
          <option value="">All companies</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Country code (e.g. AR, US)"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-32"
        />
        <input
          type="search"
          placeholder="Search by project name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchProjects()}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[200px]"
        />
        <button
          type="button"
          onClick={() => fetchProjects()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!statusFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          All statuses
        </button>
        {PROJECT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">No projects found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter || search || organizationId || countryCode
                ? "No projects match the current filters."
                : "There are no projects yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Quotes
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
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
                        {p.status}
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
                        Ver <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {projects.length} of {total} projects
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

type LogEntry = {
  id: string;
  action: string;
  entityId: string | null;
  meta: { projectName?: string; changed?: string[] } | null;
  createdAt: string;
  userName: string | null;
};

export function ProjectLogsClient() {
  const t = useT();
  const actionLabels: Record<string, string> = {
    PROJECT_CREATED: t("projects.logCreated"),
    PROJECT_UPDATED: t("projects.logUpdated"),
    PROJECT_DELETED: t("projects.logDeleted"),
  };
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 30;

  // Logs globales de proyectos: aún no hay `/api/saas/projects/logs`.
  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/logs?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const formatAction = (entry: LogEntry) => {
    const label = actionLabels[entry.action] ?? entry.action.replace(/_/g, " ").toLowerCase();
    if (entry.action === "PROJECT_UPDATED" && entry.meta?.changed?.length) {
      return `${label}: ${(entry.meta.changed as string[]).join(", ")}`;
    }
    return label;
  };

  return (
    <div className="surface-card-overflow">
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">{t("projects.noLogsYet")}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("projects.logsDate")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("projects.logsAction")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("projects.project")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("projects.logsUser")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatAction(entry)}</td>
                    <td className="px-4 py-3">
                      {entry.entityId ? (
                        <Link
                          href={`/projects/${entry.entityId}`}
                          className="text-primary hover:underline"
                        >
                          {(entry.meta as { projectName?: string })?.projectName ?? entry.entityId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-sm border border-border bg-background px-3 py-1 text-sm text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="rounded-sm border border-border bg-background px-3 py-1 text-sm text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

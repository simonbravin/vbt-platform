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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {loading ? (
        <div className="p-8 text-center text-gray-500">{t("common.loading")}</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-gray-500">{t("projects.noLogsYet")}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("projects.logsDate")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("projects.logsAction")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("projects.project")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("projects.logsUser")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{formatAction(entry)}</td>
                    <td className="px-4 py-3">
                      {entry.entityId ? (
                        <Link
                          href={`/projects/${entry.entityId}`}
                          className="text-vbt-blue hover:underline"
                        >
                          {(entry.meta as { projectName?: string })?.projectName ?? entry.entityId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
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

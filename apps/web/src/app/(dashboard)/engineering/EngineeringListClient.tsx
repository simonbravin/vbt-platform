"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Wrench, FolderOpen } from "lucide-react";
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

export function EngineeringListClient() {
  const t = useT();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchList() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      try {
        const res = await fetch(`/api/saas/engineering?${params}`);
        if (!res.ok) {
          setError(t("partner.engineering.failedToLoad"));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setRequests(data.requests ?? []);
          setTotal(data.total ?? 0);
        }
      } catch {
        if (!cancelled) setError(t("partner.engineering.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchList();
    return () => { cancelled = true; };
  }, [statusFilter, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
        >
          <option value="">{t("partner.engineering.allStatuses")}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`partner.engineering.status.${s}`)}
            </option>
          ))}
        </select>
        <Link
          href="/engineering/new"
          className="inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90"
        >
          <Plus className="h-4 w-4" />
          {t("partner.engineering.newRequest")}
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {error && <div className="p-4 bg-amber-50 text-amber-800 text-sm">{error}</div>}
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">{t("partner.engineering.noRequests")}</p>
            <Link href="/engineering/new" className="mt-2 inline-flex items-center gap-1 text-sm text-vbt-blue hover:underline">
              <Plus className="h-4 w-4" /> {t("partner.engineering.createOne")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("partner.engineering.request")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("partner.engineering.project")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("partner.engineering.status")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/engineering/${r.id}`} className="font-medium text-gray-900 hover:text-vbt-blue">
                        {r.requestNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      <Link href={`/projects/${r.projectId}`} className="flex items-center gap-1 text-gray-600 hover:text-vbt-blue">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {r.project?.projectName ?? r.projectId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                        {t(`partner.engineering.status.${r.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && requests.length > 0 && (
          <p className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100">{total} request(s)</p>
        )}
      </div>
    </div>
  );
}

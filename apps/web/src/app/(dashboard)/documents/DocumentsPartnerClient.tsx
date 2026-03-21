"use client";

import { useEffect, useState, useMemo } from "react";
import { FileText, ExternalLink, Search, LayoutGrid, LayoutList } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { documentMatchesSearchQuery } from "@/lib/documents-list-utils";

const VIEW_STORAGE_KEY = "vbt-documents-view-partner";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  visibility: string;
  category?: { name: string; code: string };
};

type ViewMode = "table" | "cards";

export function DocumentsPartnerClient() {
  const t = useT();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_STORAGE_KEY);
      if (v === "table" || v === "cards") setViewMode(v);
    } catch {
      /* ignore */
    }
  }, []);

  const setView = (m: ViewMode) => {
    setViewMode(m);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/saas/documents?limit=100");
        if (cancelled) return;
        if (!r.ok) {
          setError(t("partner.documents.failedToLoad"));
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        setDocuments(data.documents ?? []);
        setTotal(data.total ?? 0);
      } catch {
        if (!cancelled) setError(t("partner.documents.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) =>
      documentMatchesSearchQuery(searchQuery, [
        doc.title,
        doc.description,
        doc.category?.name,
        doc.category?.code,
      ])
    );
  }, [documents, searchQuery]);

  const hasSearch = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        {t("common.loading")}
      </div>
    );
  }
  if (error) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {documents.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("partner.documents.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
              autoComplete="off"
            />
          </div>
          <div
            className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
            role="group"
            aria-label={t("partner.documents.layoutToggleGroup")}
          >
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={viewMode === "table"}
              title={t("partner.documents.viewTableAria")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutList className="h-4 w-4" />
              {t("partner.documents.viewTable")}
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-pressed={viewMode === "cards"}
              title={t("partner.documents.viewCardsAria")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              {t("partner.documents.viewCards")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">{t("partner.documents.noDocuments")}</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">{t("partner.documents.noSearchResults")}</div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("partner.documents.colTitle")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("partner.documents.colCategory")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("partner.documents.colOpen")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{doc.title}</div>
                      {doc.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{doc.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{doc.category?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {doc.fileUrl?.trim() ? (
                        <a
                          href={`/api/saas/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-vbt-blue hover:underline"
                        >
                          {t("partner.documents.openFile")}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start gap-2">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900">{doc.title}</h3>
                    {doc.description && (
                      <p className="mt-1 line-clamp-3 text-sm text-gray-600">{doc.description}</p>
                    )}
                    {doc.category && (
                      <p className="mt-2 text-xs font-medium text-gray-500">{doc.category.name}</p>
                    )}
                  </div>
                </div>
                <div className="mt-auto pt-3">
                  {doc.fileUrl?.trim() ? (
                    <a
                      href={`/api/saas/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vbt-blue px-3 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90"
                    >
                      {t("partner.documents.openFile")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="block text-center text-sm text-gray-400">{t("partner.documents.noFile")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {documents.length > 0 && (
          <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-500">
            {hasSearch
              ? t("partner.documents.searchSummary", {
                  shown: filteredDocuments.length,
                  total: documents.length,
                })
              : t("partner.documents.totalCount", { count: total })}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, List, FileText, Search, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getCountryName } from "@/lib/countries";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-partner-quotes-view";

type Quote = {
  id: string;
  quoteNumber: string;
  status: string;
  totalPrice: number;
  createdAt: Date | string;
  project: {
    projectName: string;
    id: string;
    countryCode?: string | null;
    client?: { name: string } | null;
  };
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  draft: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-500",
  expired: "bg-muted text-muted-foreground",
  archived: "bg-gray-100 text-gray-600",
};

const STATUS_KEYS: Record<string, string> = {
  draft: "quotes.draft",
  sent: "quotes.sent",
  accepted: "quotes.accepted",
  rejected: "quotes.rejected",
  expired: "quotes.expired",
  archived: "quotes.archived",
};

export function QuotesClient({ quotes: initialQuotes, initialStatus }: { quotes: Quote[]; initialStatus?: string }) {
  const t = useT();
  const [view, setView] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const runSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      setQuotes(initialQuotes);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ search: q });
      if (initialStatus) params.set("status", initialStatus);
      const res = await fetch(`/api/saas/quotes?${params}`);
      let data: { quotes?: Quote[] } = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text);
      } catch {
        // non-JSON or empty
      }
      if (res.ok && Array.isArray(data.quotes)) setQuotes(data.quotes);
    } finally {
      setSearching(false);
    }
  }, [search, initialStatus, initialQuotes]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setQuotes(initialQuotes);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ search: q });
      if (initialStatus) params.set("status", initialStatus);
      fetch(`/api/saas/quotes?${params}`)
        .then(async (res) => {
          let data: { quotes?: Quote[] } = {};
          try {
            const text = await res.text();
            if (text) data = JSON.parse(text);
          } catch {
            // ignore
          }
          if (res.ok && Array.isArray(data.quotes)) setQuotes(data.quotes);
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, initialStatus, initialQuotes]);

  const handleDeleteClick = (q: Quote) => setDeleteTarget(q);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/saas/quotes/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuotes((prev) => prev.filter((x) => x.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex rounded-lg border border-border overflow-hidden flex-1 max-w-md">
          <input
            type="text"
            placeholder={t("quotes.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="flex-1 px-3 py-2 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:ring-inset"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("table")}
            title={t("projects.tableView")}
            className={`p-2 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("cards")}
            title={t("projects.cardView")}
            className={`p-2 transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-card rounded-xl p-12 text-center shadow-sm border border-border">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            {search.trim() ? t("quotes.noSearchResults") : t("quotes.noQuotes")}
          </p>
          {!search.trim() && (
            <Link href="/quotes/create" className="text-vbt-orange text-sm hover:underline mt-2 block">
              {t("quotes.createFirstLink")}
            </Link>
          )}
        </div>
      ) : view === "table" ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("quotes.quoteNumber")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("quotes.project")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("quotes.destination")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("quotes.total")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("common.status")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{t("quotes.date")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-medium text-vbt-blue hover:underline">
                      {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{q.project.projectName}</p>
                    {q.project.client?.name && <p className="text-muted-foreground text-xs">{q.project.client.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {getCountryName(q.project.countryCode) || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency(q.totalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] ?? "bg-muted text-muted-foreground"}`}>
                      {t(STATUS_KEYS[q.status] ?? q.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(q)}
                      disabled={deletingId === q.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                      title={t("quotes.deleteTitle")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {quotes.map((q) => (
            <div key={q.id} className="bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-shadow relative group">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleDeleteClick(q); }}
                disabled={deletingId === q.id}
                className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title={t("quotes.deleteTitle")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Link href={`/quotes/${q.id}`} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-vbt-orange" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] ?? "bg-muted text-muted-foreground"}`}>
                    {t(STATUS_KEYS[q.status] ?? q.status)}
                  </span>
                </div>
                <p className="font-semibold text-vbt-blue text-sm">
                  {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="font-medium text-foreground mt-1">{q.project.projectName}</p>
                {q.project.client?.name && <p className="text-muted-foreground text-xs mt-0.5">{q.project.client.name}</p>}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{getCountryName(q.project.countryCode) || "—"}</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(q.totalPrice)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("quotes.deleteQuoteTitle")}
        description={deleteTarget ? t("quotes.deleteConfirm", { number: deleteTarget.quoteNumber ?? deleteTarget.id }) : ""}
        confirmLabel={t("quotes.deleteTitle")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("quotes.deleting")}
        variant="danger"
        loading={deletingId === deleteTarget?.id}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

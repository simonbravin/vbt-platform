"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FileText, Search, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getCountryName } from "@/lib/countries";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ViewLayoutToggle } from "@/components/ui/view-layout-toggle";

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
  sent: "border-emerald-600/45 bg-emerald-500/10 text-emerald-950 dark:text-emerald-300",
  draft: "border border-alert-warningBorder bg-alert-warning text-foreground",
  accepted: "border-primary/40 bg-primary/10 text-foreground",
  rejected: "border-destructive/45 bg-destructive/10 text-destructive",
  expired: "border-border bg-muted text-muted-foreground",
  archived: "border-border bg-muted/80 text-muted-foreground",
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
        <div className="flex rounded-sm border border-border/60 overflow-hidden flex-1 max-w-md bg-background">
          <input
            type="text"
            placeholder={t("quotes.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="flex-1 px-3 py-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset font-mono placeholder:font-sans"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="px-4 py-2 border-l border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <ViewLayoutToggle view={view} onViewChange={setView} />
      </div>

      {quotes.length === 0 ? (
        <div className="bg-background rounded-sm p-12 text-center border border-border/60 border-dashed">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            {search.trim() ? t("quotes.noSearchResults") : t("quotes.noQuotes")}
          </p>
          {!search.trim() && (
            <Link href="/quotes/create" className="text-primary text-sm hover:underline mt-2 block">
              {t("quotes.createFirstLink")}
            </Link>
          )}
        </div>
      ) : view === "table" ? (
        <div className="bg-background rounded-sm border border-border/60 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("quotes.quoteNumber")}
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("quotes.project")}
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("quotes.destination")}
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("quotes.total")}
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("common.status")}
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("quotes.date")}
                </th>
                <th className="text-left px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="font-mono font-semibold tabular-nums text-primary hover:underline underline-offset-2"
                    >
                      {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground text-sm">{q.project.projectName}</p>
                    {q.project.client?.name && <p className="text-muted-foreground text-xs">{q.project.client.name}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-foreground text-sm">
                    {getCountryName(q.project.countryCode) || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums font-semibold text-foreground">
                    {formatCurrency(q.totalPrice)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-sm font-mono font-semibold uppercase tracking-wide border ${
                        STATUS_COLORS[q.status] ?? "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {t(STATUS_KEYS[q.status] ?? q.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono tabular-nums">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(q)}
                      disabled={deletingId === q.id}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-sm border border-transparent hover:border-destructive/20 disabled:opacity-50"
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
            <div
              key={q.id}
              className="bg-background rounded-sm border border-border/60 p-5 hover:border-primary/30 transition-colors relative group"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteClick(q);
                }}
                disabled={deletingId === q.id}
                className="absolute top-3 right-3 p-1.5 text-destructive hover:bg-destructive/10 rounded-sm border border-transparent hover:border-destructive/25 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title={t("quotes.deleteTitle")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Link href={`/quotes/${q.id}`} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 border border-border bg-muted/40 rounded-sm flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-sm font-mono font-semibold uppercase tracking-wide border ${
                      STATUS_COLORS[q.status] ?? "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {t(STATUS_KEYS[q.status] ?? q.status)}
                  </span>
                </div>
                <p className="font-mono font-semibold tabular-nums text-primary text-sm">
                  {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="font-medium text-foreground mt-1">{q.project.projectName}</p>
                {q.project.client?.name && <p className="text-muted-foreground text-xs mt-0.5">{q.project.client.name}</p>}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">{getCountryName(q.project.countryCode) || "—"}</span>
                  <span className="text-base font-bold text-foreground font-mono tabular-nums">{formatCurrency(q.totalPrice)}</span>
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

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FileText, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  sent: "border-primary/35 bg-primary/10 text-primary",
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

const QUOTE_STATUS_TABS = ["draft", "sent", "accepted", "rejected", "expired", "archived"] as const;

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

  const activeListStatus = initialStatus ?? "";

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("quotes.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-9"
              aria-label={t("quotes.searchPlaceholder")}
            />
          </div>
          <Button type="button" onClick={runSearch} disabled={searching} className="border border-primary/20 shrink-0">
            {searching ? t("projects.searching") : t("common.search")}
          </Button>
          <ViewLayoutToggle view={view} onViewChange={setView} />
        </div>
        <div className="w-full overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          <div className="flex flex-wrap items-center gap-2 min-w-min" role="tablist" aria-label={t("common.status")}>
            <Link
              href="/quotes"
              role="tab"
              aria-selected={!activeListStatus}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                !activeListStatus ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t("quotes.all")}
            </Link>
            {QUOTE_STATUS_TABS.map((s) => {
              const active = activeListStatus === s;
              return (
                <Link
                  key={s}
                  href={`/quotes?status=${s}`}
                  role="tab"
                  aria-selected={active}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t(STATUS_KEYS[s] ?? s)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="list-table-empty border border-dashed border-border/60">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            {search.trim() ? t("quotes.noSearchResults") : t("quotes.noQuotes")}
          </p>
          {!search.trim() && (
            <Link href="/quotes/wizard" className="text-primary text-sm hover:underline mt-2 block">
              {t("quotes.createFirstLink")}
            </Link>
          )}
        </div>
      ) : view === "table" ? (
        <div className="list-table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>{t("quotes.quoteNumber")}</th>
                <th>{t("quotes.project")}</th>
                <th>{t("quotes.destination")}</th>
                <th className="text-right">{t("quotes.total")}</th>
                <th>{t("common.status")}</th>
                <th>{t("quotes.date")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="font-medium tabular-nums text-primary hover:underline underline-offset-2"
                    >
                      {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td>
                    <p className="font-medium">{q.project.projectName}</p>
                    {q.project.client?.name && <p className="text-muted-foreground text-xs">{q.project.client.name}</p>}
                  </td>
                  <td>
                    {getCountryName(q.project.countryCode) || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="text-right tabular-nums font-semibold">
                    {formatCurrency(q.totalPrice)}
                  </td>
                  <td>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border ${
                        STATUS_COLORS[q.status] ?? "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {t(STATUS_KEYS[q.status] ?? q.status)}
                    </span>
                  </td>
                  <td className="text-muted-foreground tabular-nums text-xs">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(q)}
                      disabled={deletingId === q.id}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg border border-transparent hover:border-destructive/20 disabled:opacity-50"
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
              className="bg-background rounded-lg border border-border/60 p-5 hover:border-primary/30 transition-colors relative group"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteClick(q);
                }}
                disabled={deletingId === q.id}
                className="absolute top-3 right-3 p-1.5 text-destructive hover:bg-destructive/10 rounded-lg border border-transparent hover:border-destructive/25 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title={t("quotes.deleteTitle")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Link href={`/quotes/${q.id}`} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 border border-border bg-muted/40 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-semibold uppercase tracking-wide border ${
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

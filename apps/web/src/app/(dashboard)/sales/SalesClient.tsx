"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getInvoicedAmount } from "@/lib/sales";
import { Plus, ShoppingCart, Bell, Download } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Sale = {
  id: string;
  saleNumber: string | null;
  clientId: string;
  projectId: string;
  quantity: number;
  status: string;
  exwUsd: number;
  commissionPct: number;
  commissionAmountUsd: number;
  fobUsd: number;
  freightUsd: number;
  cifUsd: number;
  taxesFeesUsd: number;
  landedDdpUsd: number;
  invoicedBasis?: string | null;
  createdAt: string;
  client: { id: string; name: string };
  project: { id: string; name: string };
  quote: { id: string; quoteNumber: string | null } | null;
  _count: { invoices: number; payments: number };
};

const SALE_STATUSES = ["DRAFT", "CONFIRMED", "PARTIALLY_PAID", "PAID", "DUE", "CANCELLED"] as const;

export function SalesClient() {
  const t = useT();
  const statusOptions = useMemo(
    () =>
      SALE_STATUSES.map((v) => ({
        value: v,
        label: t(`partner.sales.status.${v}`),
      })),
    [t]
  );
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const limit = 20;

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (status) params.set("status", status);
    if (clientId) params.set("clientId", clientId);
    if (projectId) params.set("projectId", projectId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/sales?${params}`);
    let data: { sales?: Sale[]; total?: number } = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text);
    } catch {
      // ignore
    }
    if (res.ok && Array.isArray(data.sales)) {
      setSales(data.sales);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } else {
      setSales([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, limit, status, clientId, projectId, from, to, search]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetch("/api/clients?limit=500")
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : {};
          if (Array.isArray(d.clients)) setClients(d.clients);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    fetch("/api/saas/projects?limit=500")
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : {};
          if (Array.isArray(d.projects)) setProjects(d.projects);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/sales/notifications/due?days=7")
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : {};
          if (typeof d.count === "number") setDueCount(d.count);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-2 rounded-sm border border-vbt-orange/30 bg-vbt-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> {t("partner.sales.newSaleButton")}
          </Link>
          <Link
            href="/sales/statements"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-sm text-sm font-medium hover:bg-muted"
          >
            {t("partner.sales.statementsLink")}
          </Link>
          <a
            href={`/api/sales/export?${new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(status && { status }), ...(clientId && { clientId }), ...(projectId && { projectId }) }).toString()}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-sm text-sm font-medium hover:bg-muted"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="w-4 h-4" /> {t("partner.sales.exportCsv")}
          </a>
          {dueCount > 0 && (
            <Link
              href="/sales/statements"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/15 text-amber-900 dark:text-amber-200 rounded-sm text-sm font-medium"
            >
              <Bell className="w-4 h-4" /> {t("partner.sales.paymentsDue", { count: dueCount })}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder={t("partner.sales.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-sm text-sm w-56"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-sm text-sm"
        >
          <option value="">{t("partner.sales.allStatuses")}</option>
          {statusOptions.map(({ value: v, label: l }) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-sm text-sm min-w-[140px]"
        >
          <option value="">{t("partner.sales.allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-sm text-sm min-w-[140px]"
        >
          <option value="">{t("partner.sales.allProjects")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {(p as { projectName?: string; name?: string }).projectName ?? (p as { name?: string }).name ?? p.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 border border-border rounded-sm text-sm" aria-label={t("partner.sales.dateFrom")} title={t("partner.sales.dateFrom")} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 border border-border rounded-sm text-sm" aria-label={t("partner.sales.dateTo")} title={t("partner.sales.dateTo")} />
      </div>

      <div className="surface-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{t("partner.sales.loading")}</div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("partner.sales.noSalesFound")}</p>
            <Link href="/sales/new" className="text-primary text-sm hover:underline mt-2 block">
              {t("partner.sales.createFirstSale")}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/80">
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colSaleNumber")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colClient")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colProject")}</th>
                <th className="text-center px-2 py-2 font-medium text-foreground">{t("partner.sales.colQty")}</th>
                <th className="text-right px-2 py-2 font-medium text-foreground">{t("partner.sales.colPrice")}</th>
                <th className="text-center px-2 py-2 font-medium text-foreground">{t("partner.sales.colSalesCondition")}</th>
                <th className="text-left px-2 py-2 font-medium text-foreground">{t("partner.sales.colStatus")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-2 font-medium text-primary">
                    <Link href={`/sales/${s.id}`} className="hover:underline">
                      {s.saleNumber ?? s.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-foreground">{s.client.name}</td>
                  <td className="px-4 py-2 text-foreground">
                    <Link href={`/projects/${s.projectId}`} className="text-primary hover:underline">
                      {s.project.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center text-foreground">{s.quantity}</td>
                  <td className="px-2 py-2 text-right font-medium text-foreground">{formatCurrency(getInvoicedAmount(s))}</td>
                  <td className="px-2 py-2 text-center text-foreground font-medium">{(s.invoicedBasis || "DDP").toUpperCase()}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-sm text-xs font-medium ${
                        s.status === "PAID" ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" :
                        s.status === "DUE" ? "bg-amber-500/15 text-amber-900 dark:text-amber-200" :
                        s.status === "CANCELLED" ? "bg-muted text-muted-foreground" :
                        s.status === "PARTIALLY_PAID" ? "bg-amber-500/15 text-amber-900 dark:text-amber-200" :
                        "bg-primary/10 text-primary"
                      }`}
                    >
                      {SALE_STATUSES.includes(s.status as (typeof SALE_STATUSES)[number])
                        ? t(`partner.sales.status.${s.status}`)
                        : s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/sales/${s.id}`} className="text-primary hover:underline text-sm">
                      {t("partner.sales.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 border border-border rounded-sm text-sm disabled:opacity-50"
          >
            {t("partner.sales.previous")}
          </button>
          <span className="py-1.5 text-sm text-muted-foreground">
            {t("partner.sales.pageOf", { page, totalPages: Math.ceil(total / limit) || 1 })}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border border-border rounded-sm text-sm disabled:opacity-50"
          >
            {t("partner.sales.next")}
          </button>
        </div>
      )}
    </div>
  );
}

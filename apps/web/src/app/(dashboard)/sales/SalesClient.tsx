"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getInvoicedAmount } from "@/lib/sales";
import { Plus, ShoppingCart, Bell, Download, Search, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DATE_INPUT_FILTER } from "@/lib/ui-filter-classes";

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
  const [clientsFilterLoadFailed, setClientsFilterLoadFailed] = useState(false);
  const [projectsFilterLoadFailed, setProjectsFilterLoadFailed] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const limit = 20;

  const loadFilterDropdownData = useCallback(async () => {
    setClientsFilterLoadFailed(false);
    setProjectsFilterLoadFailed(false);
    await Promise.all([
      (async () => {
        try {
          const res = await fetch("/api/clients?limit=500");
          const text = await res.text();
          let d: { clients?: unknown } = {};
          try {
            if (text) d = JSON.parse(text) as { clients?: unknown };
          } catch {
            setClients([]);
            setClientsFilterLoadFailed(true);
            return;
          }
          if (res.ok && Array.isArray(d.clients)) {
            setClients(d.clients as { id: string; name: string }[]);
          } else {
            setClients([]);
            setClientsFilterLoadFailed(true);
          }
        } catch {
          setClients([]);
          setClientsFilterLoadFailed(true);
        }
      })(),
      (async () => {
        try {
          const res = await fetch("/api/saas/projects?limit=500");
          const text = await res.text();
          let d: { projects?: unknown } = {};
          try {
            if (text) d = JSON.parse(text) as { projects?: unknown };
          } catch {
            setProjects([]);
            setProjectsFilterLoadFailed(true);
            return;
          }
          if (res.ok && Array.isArray(d.projects)) {
            setProjects(d.projects as { id: string; name: string }[]);
          } else {
            setProjects([]);
            setProjectsFilterLoadFailed(true);
          }
        } catch {
          setProjects([]);
          setProjectsFilterLoadFailed(true);
        }
      })(),
    ]);
  }, []);

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
    void loadFilterDropdownData();
  }, [loadFilterDropdownData]);

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
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild className="gap-2 border border-primary/20">
          <Link href="/sales/new">
            <Plus className="w-4 h-4" /> {t("partner.sales.newSaleButton")}
          </Link>
        </Button>
        <Button variant="outline" asChild className="border-border/60">
          <Link href="/sales/statements">{t("partner.sales.statementsLink")}</Link>
        </Button>
        <Button variant="outline" asChild className="gap-2 border-border/60">
          <a
            href={`/api/sales/export?${new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(status && { status }), ...(clientId && { clientId }), ...(projectId && { projectId }) }).toString()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="w-4 h-4" /> {t("partner.sales.exportCsv")}
          </a>
        </Button>
        {dueCount > 0 && (
          <Button variant="outline" asChild className="gap-2 border-border/80 bg-muted/50 text-foreground hover:bg-muted">
            <Link href="/sales/statements">
              <Bell className="w-4 h-4" /> {t("partner.sales.paymentsDue", { count: dueCount })}
            </Link>
          </Button>
        )}
      </div>

      {(clientsFilterLoadFailed || projectsFilterLoadFailed) && (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>{t("partner.sales.filterOptionsLoadTitle")}</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive/95">
              {clientsFilterLoadFailed && <li>{t("partner.sales.filterClientsLoadFailed")}</li>}
              {projectsFilterLoadFailed && <li>{t("partner.sales.filterProjectsLoadFailed")}</li>}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => void loadFilterDropdownData()}
            >
              {t("partner.sales.filterOptionsRetry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-full min-w-[200px] max-w-xs sm:w-auto sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("partner.sales.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label={t("partner.sales.searchPlaceholder")}
          />
        </div>
        <FilterSelect
          value={status}
          onValueChange={setStatus}
          emptyOptionLabel={t("partner.sales.allStatuses")}
          options={statusOptions}
          aria-label={t("partner.sales.allStatuses")}
        />
        <FilterSelect
          value={clientId}
          onValueChange={setClientId}
          emptyOptionLabel={t("partner.sales.allClients")}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
          aria-label={t("partner.sales.allClients")}
        />
        <FilterSelect
          value={projectId}
          onValueChange={setProjectId}
          emptyOptionLabel={t("partner.sales.allProjects")}
          options={projects.map((p) => ({
            value: p.id,
            label:
              (p as { projectName?: string; name?: string }).projectName ??
              (p as { name?: string }).name ??
              p.id.slice(0, 8),
          }))}
          aria-label={t("partner.sales.allProjects")}
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={DATE_INPUT_FILTER}
          aria-label={t("partner.sales.dateFrom")}
          title={t("partner.sales.dateFrom")}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={DATE_INPUT_FILTER}
          aria-label={t("partner.sales.dateTo")}
          title={t("partner.sales.dateTo")}
        />
      </div>

      <div className="list-table-wrap overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{t("partner.sales.loading")}</div>
        ) : sales.length === 0 ? (
          <div className="list-table-empty">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("partner.sales.noSalesFound")}</p>
            <Link href="/sales/new" className="text-primary text-sm hover:underline mt-2 block">
              {t("partner.sales.createFirstSale")}
            </Link>
          </div>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>{t("partner.sales.colSaleNumber")}</th>
                <th>{t("partner.sales.colClient")}</th>
                <th>{t("partner.sales.colProject")}</th>
                <th className="text-center">{t("partner.sales.colQty")}</th>
                <th className="text-right">{t("partner.sales.colPrice")}</th>
                <th className="text-center">{t("partner.sales.colSalesCondition")}</th>
                <th>{t("partner.sales.colStatus")}</th>
                <th>{t("partner.sales.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-primary">
                    <Link href={`/sales/${s.id}`} className="hover:underline">
                      {s.saleNumber ?? s.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{s.client.name}</td>
                  <td>
                    <Link href={`/projects/${s.projectId}`} className="text-primary hover:underline">
                      {s.project.name}
                    </Link>
                  </td>
                  <td className="text-center">{s.quantity}</td>
                  <td className="text-right font-medium tabular-nums">{formatCurrency(getInvoicedAmount(s))}</td>
                  <td className="text-center font-medium">{(s.invoicedBasis || "DDP").toUpperCase()}</td>
                  <td>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${
                        s.status === "PAID" ? "border border-primary/25 bg-primary/10 text-primary" :
                        s.status === "DUE" ? "border border-border/80 bg-muted text-foreground" :
                        s.status === "CANCELLED" ? "bg-muted text-muted-foreground" :
                        s.status === "PARTIALLY_PAID" ? "border border-border/80 bg-muted text-foreground" :
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
        <div className="flex justify-center items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-border/60"
          >
            {t("partner.sales.previous")}
          </Button>
          <span className="py-1.5 text-sm text-muted-foreground">
            {t("partner.sales.pageOf", { page, totalPages: Math.ceil(total / limit) || 1 })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            className="border-border/60"
          >
            {t("partner.sales.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getInvoicedAmount } from "@/lib/sales";
import { ShoppingCart, Bell, Download, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

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
  quote: {
    id: string;
    quoteNumber: string | null;
    visionLatamMarkupPct?: number | null;
    vlCommissionUsd?: number | null;
    partnerMarkupPct?: number | null;
    partnerMarginUsd?: number | null;
  } | null;
  organization?: { id: string; name: string };
  _count: { invoices: number; payments: number };
};

const SALE_STATUSES = ["DRAFT", "CONFIRMED", "PARTIALLY_PAID", "PAID", "DUE", "CANCELLED"] as const;

export function SuperadminSalesListClient() {
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
  const [organizationId, setOrganizationId] = useState("");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetch("/api/saas/partners?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        d?.partners && setPartners(d.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setClients([]);
      setProjects([]);
      return;
    }
    const q = new URLSearchParams({ limit: "500", organizationId });
    fetch(`/api/clients?${q}`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : {};
          if (Array.isArray(d.clients)) setClients(d.clients);
        } catch {
          setClients([]);
        }
      })
      .catch(() => setClients([]));
    fetch(`/api/saas/projects?${q}`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : {};
          const raw = d.projects ?? [];
          if (Array.isArray(raw)) {
            setProjects(
              raw.map((p: { id: string; projectName?: string; name?: string }) => ({
                id: p.id,
                name: p.projectName ?? p.name ?? p.id.slice(0, 8),
              }))
            );
          }
        } catch {
          setProjects([]);
        }
      })
      .catch(() => setProjects([]));
  }, [organizationId]);

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
    if (organizationId) params.set("organizationId", organizationId);
    const res = await fetch(`/api/sales?${params}`);
    let data: { sales?: Sale[]; total?: number } = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = {};
    }
    if (res.ok && Array.isArray(data.sales)) {
      setSales(data.sales);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } else {
      setSales([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, limit, status, clientId, projectId, from, to, search, organizationId]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    const params = new URLSearchParams({ days: "7" });
    if (organizationId) params.set("organizationId", organizationId);
    fetch(`/api/sales/notifications/due?${params}`)
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
  }, [organizationId]);

  const exportQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (status) p.set("status", status);
    if (clientId) p.set("clientId", clientId);
    if (projectId) p.set("projectId", projectId);
    if (organizationId) p.set("organizationId", organizationId);
    return p.toString();
  }, [from, to, status, clientId, projectId, organizationId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={
              organizationId
                ? `/superadmin/sales/new?organizationId=${encodeURIComponent(organizationId)}`
                : "/superadmin/sales/new"
            }
            className="inline-flex items-center gap-2 rounded-full border border-transparent bg-primary px-5 py-2.5 text-[17px] font-normal text-primary-foreground hover:opacity-[0.88]"
          >
            <Plus className="w-4 h-4" /> {t("superadmin.sales.newSaleButton")}
          </Link>
          {organizationId ? (
            <Link
              href={`/superadmin/sales/statements?organizationId=${encodeURIComponent(organizationId)}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted"
            >
              {t("partner.sales.statementsLink")}
            </Link>
          ) : null}
          <a
            href={exportQuery ? `/api/sales/export?${exportQuery}` : "/api/sales/export"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="w-4 h-4" /> {t("partner.sales.exportCsv")}
          </a>
          {dueCount > 0 && organizationId ? (
            <Link
              href={`/superadmin/sales/statements?organizationId=${encodeURIComponent(organizationId)}`}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted px-4 py-2 text-[15px] font-medium text-foreground"
            >
              <Bell className="w-4 h-4" /> {t("partner.sales.paymentsDue", { count: dueCount })}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <FilterSelect
          value={organizationId}
          onValueChange={(v) => {
            setOrganizationId(v);
            setPage(1);
            setClientId("");
            setProjectId("");
          }}
          emptyOptionLabel={t("superadmin.quotesList.allCompanies")}
          options={partners.map((p) => ({ value: p.id, label: p.name }))}
          aria-label={t("admin.entities.partnerLabel")}
          triggerClassName="h-9 min-w-[200px] max-w-[min(100vw-2rem,280px)] text-sm"
        />
        <input
          type="text"
          placeholder={t("superadmin.salesList.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm w-56"
        />
        <FilterSelect
          value={status}
          onValueChange={setStatus}
          emptyOptionLabel={t("partner.sales.allStatuses")}
          options={statusOptions}
          aria-label={t("common.status")}
          triggerClassName="h-9 min-w-[8rem] max-w-[min(100vw-2rem,240px)] text-sm"
        />
        <FilterSelect
          value={clientId}
          onValueChange={setClientId}
          emptyOptionLabel={t("partner.sales.allClients")}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
          disabled={!organizationId}
          aria-label={t("partner.sales.allClients")}
          triggerClassName="h-9 min-w-[140px] max-w-[min(100vw-2rem,220px)] text-sm"
        />
        <FilterSelect
          value={projectId}
          onValueChange={setProjectId}
          emptyOptionLabel={t("partner.sales.allProjects")}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          disabled={!organizationId}
          aria-label={t("partner.sales.allProjects")}
          triggerClassName="h-9 min-w-[140px] max-w-[min(100vw-2rem,220px)] text-sm"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm"
          aria-label={t("partner.sales.dateFrom")}
          title={t("partner.sales.dateFrom")}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm"
          aria-label={t("partner.sales.dateTo")}
          title={t("partner.sales.dateTo")}
        />
      </div>

      <div className="surface-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{t("partner.sales.loading")}</div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("partner.sales.noSalesFound")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/80">
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("superadmin.salesList.colPartner")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colSaleNumber")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colClient")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colProject")}</th>
                <th className="text-center px-2 py-2 font-medium text-foreground">{t("partner.sales.colQty")}</th>
                <th className="text-right px-2 py-2 font-medium text-foreground">{t("partner.sales.colPrice")}</th>
                <th className="text-right px-2 py-2 font-medium text-foreground">{t("superadmin.salesList.colVlPct")}</th>
                <th className="text-right px-2 py-2 font-medium text-foreground">{t("superadmin.salesList.colVlCommission")}</th>
                <th className="text-right px-2 py-2 font-medium text-foreground">{t("superadmin.salesList.colPartnerMarkupPct")}</th>
                <th className="text-center px-2 py-2 font-medium text-foreground">{t("partner.sales.colSalesCondition")}</th>
                <th className="text-left px-2 py-2 font-medium text-foreground">{t("partner.sales.colStatus")}</th>
                <th className="text-left px-4 py-2 font-medium text-foreground">{t("partner.sales.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-2 text-muted-foreground">{s.organization?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-primary">
                    <Link href={`/superadmin/sales/${s.id}`} className="hover:underline">
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
                  <td className="px-2 py-2 text-right tabular-nums text-foreground">
                    {s.quote?.visionLatamMarkupPct != null ? `${s.quote.visionLatamMarkupPct}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-foreground">
                    {s.quote?.vlCommissionUsd != null ? formatCurrency(s.quote.vlCommissionUsd) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-foreground">
                    {s.quote?.partnerMarkupPct != null ? `${s.quote.partnerMarkupPct}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-center text-foreground font-medium">{(s.invoicedBasis || "DDP").toUpperCase()}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-micro font-medium ${
                        s.status === "PAID"
                          ? "border border-primary/25 bg-primary/10 text-primary"
                          : s.status === "DUE"
                            ? "border border-border/80 bg-muted text-foreground"
                            : s.status === "CANCELLED"
                              ? "bg-muted text-muted-foreground"
                              : s.status === "PARTIALLY_PAID"
                                ? "border border-border/80 bg-muted text-foreground"
                                : "bg-primary/10 text-primary"
                      }`}
                    >
                      {SALE_STATUSES.includes(s.status as (typeof SALE_STATUSES)[number])
                        ? t(`partner.sales.status.${s.status}`)
                        : s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/superadmin/sales/${s.id}`} className="text-primary hover:underline text-sm">
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
            className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-50"
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
            className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-50"
          >
            {t("partner.sales.next")}
          </button>
        </div>
      )}
    </div>
  );
}

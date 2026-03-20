"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, Download, Package, Mail, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Country = { id: string; name: string; code: string };
type Project = {
  id: string;
  name: string;
  client: string | null;
  clientRecord?: { id: string; name: string } | null;
  location: string | null;
  status: string;
  soldAt: string | null;
  finalAmountUsd: number | null;
  country: { id: string; name: string; code: string } | null;
  baselineQuote: { id: string; quoteNumber: string | null; fobUsd: number } | null;
  _count: { quotes: number };
};

type Summary = {
  totalQuoted: number;
  inProgress: number;
  sold: number;
  archived: number;
  conversionRate: number;
  totalValueQuoted: number;
  totalValueSold: number;
};

const PIPELINE_STATUS_VALUES = ["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"] as const;

type PieceRow = { pieceId: string; description: string; systemCode: string | null; qty: number; kg: number; m2: number };
type PiecesData = { byQty: PieceRow[]; byKg: PieceRow[]; byM2: PieceRow[] };

type Client = { id: string; name: string };

export function ReportsClient({ countries, clients, canSendReport = true }: { countries: Country[]; clients: Client[]; canSendReport?: boolean }) {
  const { t, locale } = useLanguage();
  const numberLocale = locale === "es" ? "es-419" : "en-US";

  const projectStatusLabel = (code: string) => t(`partner.reports.status.${code}`);
  const saleStatusLabel = (code: string) => t(`partner.sales.status.${code}`);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [clientId, setClientId] = useState("");
  const [soldFrom, setSoldFrom] = useState("");
  const [soldTo, setSoldTo] = useState("");
  const [search, setSearch] = useState("");
  const [pieces, setPieces] = useState<PiecesData | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [salesSummary, setSalesSummary] = useState<{
    totalSales: number;
    totalValue: number;
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    byStatus: Record<string, number>;
    entitySummary: { id: string; name: string; slug: string; invoiced: number; paid: number; balance: number }[];
  } | null>(null);
  const limit = 20;

  const buildReportParams = useCallback(() => {
    const params = new URLSearchParams();
    if (page) params.set("page", String(page));
    if (limit) params.set("limit", String(limit));
    if (status) params.set("status", status);
    if (countryId) params.set("countryCode", countryId);
    if (clientId) params.set("clientId", clientId);
    if (soldFrom) params.set("soldFrom", soldFrom);
    if (soldTo) params.set("soldTo", soldTo);
    if (search.trim()) params.set("search", search.trim());
    return params;
  }, [page, limit, status, countryId, clientId, soldFrom, soldTo, search]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = buildReportParams();
    try {
      const res = await fetch(`/api/reports/projects?${params}`);
      let data: { projects?: Project[]; total?: number; summary?: Summary | null } = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text) as typeof data;
      } catch {
        // non-JSON or empty response
      }
      if (res.ok && Array.isArray(data.projects)) {
        setProjects(data.projects);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setSummary(data.summary ?? null);
      } else {
        setProjects([]);
        setTotal(0);
        setSummary(null);
      }
    } catch {
      setProjects([]);
      setTotal(0);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [buildReportParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetch("/api/reports/pieces?limit=15")
      .then(async (r) => {
        if (!r.ok) return;
        try {
          const text = await r.text();
          if (text) setPieces(JSON.parse(text));
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/sales/reports/summary")
      .then(async (r) => {
        if (!r.ok) return;
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : null;
          if (data && typeof data.totalSales === "number") setSalesSummary(data);
        } catch {
          // ignore parse error or non-JSON
        }
      })
      .catch(() => {});
  }, []);

  const handleExportCsv = () => {
    const params = buildReportParams();
    params.set("limit", "10000");
    params.set("format", "csv");
    window.location.href = `/api/reports/projects?${params}`;
  };

  const handleExportExcel = () => {
    const params = buildReportParams();
    params.set("limit", "10000");
    params.set("format", "xlsx");
    window.location.href = `/api/reports/projects?${params}`;
  };

  const handleEmailReport = async () => {
    if (!emailTo.trim()) return;
    setEmailSending(true);
    setEmailMessage(null);
    try {
      const res = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject.trim() || undefined,
          status: status || undefined,
          countryId: countryId || undefined,
          clientId: clientId || undefined,
          soldFrom: soldFrom || undefined,
          soldTo: soldTo || undefined,
          search: search.trim() || undefined,
          locale,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const sentTo = emailTo.trim();
        setEmailMessage({ type: "success", text: data.message ?? t("partner.reports.emailSentTo", { email: sentTo }) });
        setEmailTo("");
        setEmailSubject("");
        setTimeout(() => { setEmailOpen(false); setEmailMessage(null); }, 2000);
      } else {
        setEmailMessage({ type: "error", text: data.error ?? t("partner.reports.failedToSend") });
      }
    } catch {
      setEmailMessage({ type: "error", text: t("partner.sales.failedToSendEmail") });
    } finally {
      setEmailSending(false);
    }
  };

  const handleSalesExport = () => {
    fetch("/api/sales?limit=5000")
      .then((r) => r.json())
      .then((data) => {
        const rows = data.sales ?? [];
        const escape = (v: unknown) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const headers = [
          t("partner.reports.csv.saleNumber"),
          t("partner.reports.csv.client"),
          t("partner.reports.csv.project"),
          t("partner.reports.csv.status"),
          t("partner.reports.csv.quantity"),
          t("partner.reports.csv.exw"),
          t("partner.reports.csv.fob"),
          t("partner.reports.csv.cif"),
          t("partner.reports.csv.landedDdp"),
          t("partner.reports.csv.created"),
        ];
        const csvRows = [
          headers.join(","),
          ...rows.map((s: { saleNumber: string | null; client?: { name: string }; project?: { name: string }; status: string; quantity: number; exwUsd: number; fobUsd: number; cifUsd: number; landedDdpUsd: number; createdAt: string }) =>
            [
              s.saleNumber ?? "",
              s.client?.name ?? "",
              s.project?.name ?? "",
              saleStatusLabel(s.status),
              s.quantity,
              s.exwUsd ?? "",
              s.fobUsd ?? "",
              s.cifUsd ?? "",
              s.landedDdpUsd ?? "",
              s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : "",
            ].map(escape).join(",")
          ),
        ];
        const csv = csvRows.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vbt-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t("partner.reports.filtersTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t("partner.reports.filterStatus")}</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            >
              <option value="">{t("partner.reports.all")}</option>
              {PIPELINE_STATUS_VALUES.map((v) => (
                <option key={v} value={v}>{t(`partner.reports.status.${v}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t("partner.reports.filterCountry")}</label>
            <select
              value={countryId}
              onChange={(e) => { setCountryId(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            >
              <option value="">{t("partner.reports.all")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t("partner.reports.filterClient")}</label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            >
              <option value="">{t("partner.reports.all")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t("partner.reports.soldFrom")}</label>
            <input
              type="date"
              value={soldFrom}
              onChange={(e) => { setSoldFrom(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t("partner.reports.soldTo")}</label>
            <input
              type="date"
              value={soldTo}
              onChange={(e) => { setSoldTo(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <input
            type="text"
            placeholder={t("partner.reports.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchReport())}
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => { setPage(1); fetchReport(); }}
            className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-vbt-blue/90 focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:ring-offset-2"
          >
            {t("partner.reports.apply")}
          </button>
        </div>
      </div>

      {/* Sales KPIs */}
      {salesSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> {t("partner.reports.salesSection")}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSalesExport}
                className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> {t("partner.reports.exportCsv")}
              </button>
              <Link href="/sales" className="text-sm text-vbt-blue hover:underline font-medium">{t("partner.reports.viewSalesLink")}</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-gray-500 text-xs">{t("partner.reports.kpiTotalSales")}</div>
              <p className="text-lg font-bold text-gray-900">{salesSummary.totalSales}</p>
            </div>
            <div>
              <div className="text-gray-500 text-xs">{t("partner.reports.kpiTotalValueDdp")}</div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(salesSummary.totalValue)}</p>
            </div>
            <div>
              <div className="text-gray-500 text-xs">{t("partner.reports.kpiInvoiced")}</div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(salesSummary.totalInvoiced)}</p>
            </div>
            <div>
              <div className="text-gray-500 text-xs">{t("partner.reports.kpiPaid")}</div>
              <p className="text-lg font-bold text-green-700">{formatCurrency(salesSummary.totalPaid)}</p>
            </div>
            <div>
              <div className="text-gray-500 text-xs">{t("partner.reports.kpiPending")}</div>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(salesSummary.totalPending)}</p>
            </div>
          </div>
          {salesSummary.entitySummary?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm text-gray-600">
              {salesSummary.entitySummary.map((e) => (
                <div key={e.id} className="flex justify-between gap-2 flex-wrap">
                  <span className="font-medium text-gray-700">{e.name}</span>
                  <span>
                    {t("partner.reports.entityBalances", {
                      invoiced: formatCurrency(e.invoiced),
                      paid: formatCurrency(e.paid),
                      balance: formatCurrency(e.balance),
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <BarChart3 className="w-4 h-4" /> {t("partner.reports.kpiTotalQuoted")}
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalQuoted}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">{t("partner.reports.kpiInProgress")}</div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summary.inProgress}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">{t("partner.reports.kpiSold")}</div>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.sold}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">{t("partner.reports.kpiArchived")}</div>
            <p className="text-2xl font-bold text-gray-600 mt-1">{summary.archived}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">{t("partner.reports.kpiWinRate")}</div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.conversionRate}%</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">{t("partner.reports.kpiTotalValueQuotedFob")}</div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(summary.totalValueQuoted)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">{t("partner.reports.kpiTotalValueSold")}</div>
            <p className="text-lg font-bold text-green-700 mt-1">{formatCurrency(summary.totalValueSold)}</p>
          </div>
        </div>
      )}

      {/* Piece analytics */}
      {pieces && (pieces.byQty.length > 0 || pieces.byKg.length > 0 || pieces.byM2.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-800 text-sm">{t("partner.reports.piecesTopQty")}</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t("partner.reports.colPiece")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t("partner.reports.colQty")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pieces.byQty.map((row, i) => (
                    <tr key={row.pieceId + i}>
                      <td className="px-3 py-2 text-gray-800 truncate max-w-[180px]" title={row.description}>{row.description}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.qty.toLocaleString(numberLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-800 text-sm">{t("partner.reports.piecesTopKg")}</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t("partner.reports.colPiece")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t("partner.reports.colKg")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pieces.byKg.map((row, i) => (
                    <tr key={row.pieceId + i}>
                      <td className="px-3 py-2 text-gray-800 truncate max-w-[180px]" title={row.description}>{row.description}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.kg.toLocaleString(numberLocale, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-800 text-sm">{t("partner.reports.piecesTopM2")}</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t("partner.reports.colPiece")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t("partner.reports.colM2")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pieces.byM2.map((row, i) => (
                    <tr key={row.pieceId + i}>
                      <td className="px-3 py-2 text-gray-800 truncate max-w-[180px]" title={row.description}>{row.description}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.m2.toLocaleString(numberLocale, { maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Table + Export */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("partner.reports.projectsSection")}</h2>
          <div className="flex items-center gap-2">
            {canSendReport && (
              <button
                type="button"
                onClick={() => setEmailOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Mail className="w-4 h-4" /> {t("partner.reports.emailReport")}
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> {t("partner.reports.exportCsv")}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> {t("partner.reports.exportExcel")}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">{t("partner.reports.loading")}</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t("partner.reports.noProjectsMatch")}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colProject")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colClient")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colCountry")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colStatus")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colBaselineQuote")}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colFob")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colSaleDate")}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colFinalAmount")}</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("partner.reports.colQuotes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.id}`} className="font-medium text-vbt-blue hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{(p.clientRecord?.name ?? p.client) ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.country?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "won" || p.status === "SOLD" ? "bg-green-100 text-green-700" :
                          p.status === "lost" || p.status === "ARCHIVED" ? "bg-gray-200 text-gray-600" :
                          p.status === "quoting" || p.status === "QUOTE_SENT" ? "bg-blue-100 text-blue-700" :
                          p.status === "qualified" || p.status === "QUOTED" ? "bg-amber-100 text-amber-700" :
                          p.status === "engineering" ? "bg-indigo-100 text-indigo-700" :
                          p.status === "on_hold" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{projectStatusLabel(p.status)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p.baselineQuote ? (
                          <Link href={`/quotes/${p.baselineQuote.id}`} className="text-vbt-blue hover:underline">
                            {p.baselineQuote.quoteNumber ?? "—"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{p.baselineQuote ? formatCurrency(p.baselineQuote.fobUsd) : "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.soldAt ? new Date(p.soldAt).toLocaleDateString(numberLocale) : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{p.finalAmountUsd != null ? formatCurrency(p.finalAmountUsd) : "—"}</td>
                      <td className="px-4 py-3 text-center">{p._count.quotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div className="p-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>
                  {t("partner.reports.showingRange", {
                    from: (page - 1) * limit + 1,
                    to: Math.min(page * limit, total),
                    total,
                  })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    {t("partner.sales.previous")}
                  </button>
                  <button
                    type="button"
                    disabled={page * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    {t("partner.sales.next")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Email report modal */}
      {emailOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4">
            <h3 className="font-semibold text-lg mb-4">{t("partner.reports.emailModalTitle")}</h3>
            <p className="text-gray-500 text-sm mb-4">{t("partner.reports.emailModalDescription")}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.reports.emailAddressLabel")}</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={t("partner.reports.emailAddressPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.reports.subjectOptional")}</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t("partner.reports.subjectPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              {emailMessage && (
                <p className={`text-sm ${emailMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>{emailMessage.text}</p>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                type="button"
                onClick={() => { setEmailOpen(false); setEmailMessage(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleEmailReport}
                disabled={emailSending || !emailTo.trim()}
                className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {emailSending ? t("partner.sales.sending") : t("partner.sales.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

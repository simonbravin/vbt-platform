"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, Download, Package } from "lucide-react";

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

const statusLabel: Record<string, string> = {
  QUOTED: "Quoted",
  IN_CONVERSATION: "In conversation",
  SOLD: "Sold",
  ARCHIVED: "Archived",
};

type PieceRow = { pieceId: string; description: string; systemCode: string | null; qty: number; kg: number; m2: number };
type PiecesData = { byQty: PieceRow[]; byKg: PieceRow[]; byM2: PieceRow[] };

type Client = { id: string; name: string };

export function ReportsClient({ countries, clients }: { countries: Country[]; clients: Client[] }) {
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
  const limit = 20;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (page) params.set("page", String(page));
    if (limit) params.set("limit", String(limit));
    if (status) params.set("status", status);
    if (countryId) params.set("countryId", countryId);
    if (clientId) params.set("clientId", clientId);
    if (soldFrom) params.set("soldFrom", soldFrom);
    if (soldTo) params.set("soldTo", soldTo);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/reports/projects?${params}`);
    const data = await res.json();
    if (res.ok) {
      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
    }
    setLoading(false);
  }, [page, limit, status, countryId, clientId, soldFrom, soldTo, search]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetch("/api/reports/pieces?limit=15")
      .then((r) => r.json())
      .then((data) => setPieces(data))
      .catch(() => {});
  }, []);

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    if (status) params.set("status", status);
    if (countryId) params.set("countryId", countryId);
    if (clientId) params.set("clientId", clientId);
    if (soldFrom) params.set("soldFrom", soldFrom);
    if (soldTo) params.set("soldTo", soldTo);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/reports/projects?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const rows = data.projects ?? [];
        const headers = [
          "Project",
          "Client",
          "Location",
          "Country",
          "Status",
          "Baseline quote",
          "Project FOB",
          "Sale date",
          "Final amount",
          "Quotes count",
        ];
        const escape = (v: unknown) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csvRows = [
          headers.join(","),
          ...rows.map((p: Project) =>
            [
              p.name,
              (p.clientRecord?.name ?? p.client) ?? "",
              p.location ?? "",
              p.country?.name ?? "",
              statusLabel[p.status] ?? p.status,
              p.baselineQuote?.quoteNumber ?? "",
              p.baselineQuote?.fobUsd ?? "",
              p.soldAt ? new Date(p.soldAt).toLocaleDateString() : "",
              p.finalAmountUsd ?? "",
              p._count.quotes,
            ].map(escape).join(",")
          ),
        ];
        const csv = csvRows.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vbt-projects-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="QUOTED">Quoted</option>
              <option value="IN_CONVERSATION">In conversation</option>
              <option value="SOLD">Sold</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <select
              value={countryId}
              onChange={(e) => { setCountryId(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sold from</label>
            <input
              type="date"
              value={soldFrom}
              onChange={(e) => { setSoldFrom(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sold to</label>
            <input
              type="date"
              value={soldTo}
              onChange={(e) => { setSoldTo(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <input
            type="text"
            placeholder="Search project, client, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchReport())}
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => { setPage(1); fetchReport(); }}
            className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
          >
            Apply
          </button>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <BarChart3 className="w-4 h-4" /> Total quoted
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalQuoted}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">In progress</div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summary.inProgress}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">Sold</div>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.sold}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">Archived</div>
            <p className="text-2xl font-bold text-gray-600 mt-1">{summary.archived}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">Win rate (sold vs closed)</div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.conversionRate}%</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">Total value quoted (FOB)</div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(summary.totalValueQuoted)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm">Total value sold</div>
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
              <h3 className="font-semibold text-gray-800 text-sm">Top pieces by quantity</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Piece</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pieces.byQty.map((row, i) => (
                    <tr key={row.pieceId + i}>
                      <td className="px-3 py-2 text-gray-800 truncate max-w-[180px]" title={row.description}>{row.description}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-800 text-sm">Top pieces by weight (kg)</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Piece</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pieces.byKg.map((row, i) => (
                    <tr key={row.pieceId + i}>
                      <td className="px-3 py-2 text-gray-800 truncate max-w-[180px]" title={row.description}>{row.description}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.kg.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-800 text-sm">Top pieces by m²</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Piece</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">m²</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pieces.byM2.map((row, i) => (
                    <tr key={row.pieceId + i}>
                      <td className="px-3 py-2 text-gray-800 truncate max-w-[180px]" title={row.description}>{row.description}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.m2.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td>
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
          <h2 className="font-semibold text-gray-800">Projects</h2>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No projects match the filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Country</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Baseline quote</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">FOB</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sale date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Final amount</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Quotes</th>
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
                          p.status === "SOLD" ? "bg-green-100 text-green-700" :
                          p.status === "ARCHIVED" ? "bg-gray-200 text-gray-600" :
                          p.status === "IN_CONVERSATION" ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>{statusLabel[p.status] ?? p.status}</span>
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
                      <td className="px-4 py-3 text-gray-600">{p.soldAt ? new Date(p.soldAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{p.finalAmountUsd != null ? formatCurrency(p.finalAmountUsd) : "—"}</td>
                      <td className="px-4 py-3 text-center">{p._count.quotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div className="p-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

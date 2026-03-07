"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Plus, ShoppingCart, Bell, Download } from "lucide-react";

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

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PARTIALLY_PAID: "Partial",
  PAID: "Paid",
  DUE: "Due",
  CANCELLED: "Cancelled",
};

export function SalesClient() {
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
    const data = await res.json();
    if (res.ok) {
      setSales(data.sales ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [page, limit, status, clientId, projectId, from, to, search]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetch("/api/clients?limit=500")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => {});
    fetch("/api/projects?limit=500")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/sales/notifications/due?days=7")
      .then((r) => r.json())
      .then((d) => setDueCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            <Plus className="w-4 h-4" /> New sale
          </Link>
          <Link
            href="/sales/statements"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Statements
          </Link>
          <a
            href={`/api/sales/export?${new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(status && { status }), ...(clientId && { clientId }), ...(projectId && { projectId }) }).toString()}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
          {dueCount > 0 && (
            <Link
              href="/sales/statements"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium"
            >
              <Bell className="w-4 h-4" /> {dueCount} payment(s) due
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search by sale #, client, project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-56"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(statusLabel).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm min-w-[140px]"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm min-w-[140px]"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{(p as any).name}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" placeholder="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" placeholder="To" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sales found</p>
            <Link href="/sales/new" className="text-vbt-orange text-sm hover:underline mt-2 block">
              Create your first sale →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-left px-4 py-2 font-medium text-gray-700">Sale #</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Client</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Project</th>
                <th className="text-center px-2 py-2 font-medium text-gray-700">Qty</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">EXW</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">Comm %</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">FOB</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">Freight</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">CIF</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">Taxes</th>
                <th className="text-right px-2 py-2 font-medium text-gray-700">DDP</th>
                <th className="text-center px-2 py-2 font-medium text-gray-700">Sales condition</th>
                <th className="text-left px-2 py-2 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-vbt-blue">
                    <Link href={`/sales/${s.id}`} className="hover:underline">
                      {s.saleNumber ?? s.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{s.client.name}</td>
                  <td className="px-4 py-2 text-gray-700">
                    <Link href={`/projects/${s.projectId}`} className="text-vbt-blue hover:underline">
                      {s.project.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-700">{s.quantity}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.exwUsd)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{s.commissionPct}%</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.fobUsd)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.freightUsd)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.cifUsd)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.taxesFeesUsd)}</td>
                  <td className="px-2 py-2 text-right font-medium text-gray-900">{formatCurrency(s.landedDdpUsd)}</td>
                  <td className="px-2 py-2 text-center text-gray-700 font-medium">{(s.invoicedBasis || "DDP").toUpperCase()}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        s.status === "PAID" ? "bg-green-100 text-green-700" :
                        s.status === "DUE" ? "bg-amber-100 text-amber-800" :
                        s.status === "CANCELLED" ? "bg-gray-100 text-gray-600" :
                        s.status === "PARTIALLY_PAID" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {statusLabel[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/sales/${s.id}`} className="text-vbt-blue hover:underline text-sm">
                      View
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
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="py-1.5 text-sm text-gray-600">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

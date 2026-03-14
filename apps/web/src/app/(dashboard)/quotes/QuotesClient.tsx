"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, List, FileText, Search, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getCountryName } from "@/lib/countries";

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
  expired: "bg-gray-100 text-gray-500",
};

export function QuotesClient({ quotes: initialQuotes, initialStatus }: { quotes: Quote[]; initialStatus?: string }) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim()) setQuotes(initialQuotes);
  }, [search.trim(), initialQuotes]);

  const runSearch = useCallback(async () => {
    if (!search.trim()) {
      setQuotes(initialQuotes);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ search: search.trim() });
      if (initialStatus) params.set("status", initialStatus);
      const res = await fetch(`/api/saas/quotes?${params}`);
      const data = await res.json();
      setQuotes(data?.quotes ?? []);
    } finally {
      setSearching(false);
    }
  }, [search, initialStatus, initialQuotes]);

  const handleDelete = async (q: Quote) => {
    if (!confirm(`¿Eliminar la cotización ${q.quoteNumber ?? q.id} de forma permanente? No se puede deshacer.`)) return;
    setDeletingId(q.id);
    try {
      const res = await fetch(`/api/quotes/${q.id}`, { method: "DELETE" });
      if (res.ok) setQuotes((prev) => prev.filter((x) => x.id !== q.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por número, proyecto, cliente, destino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="flex-1 px-3 py-2 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:ring-inset"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView("table")}
            title="Table view"
            className={`p-2 transition-colors ${view === "table" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("cards")}
            title="Card view"
            className={`p-2 transition-colors ${view === "cards" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Quote #", "Project", "Destination", "Total", "Status", "Date", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-medium text-vbt-blue hover:underline">
                      {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{q.project.projectName}</p>
                    {q.project.client?.name && <p className="text-gray-400 text-xs">{q.project.client.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {getCountryName(q.project.countryCode) || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {formatCurrency(q.totalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      disabled={deletingId === q.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Eliminar definitivamente"
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
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow relative group">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleDelete(q); }}
                disabled={deletingId === q.id}
                className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Eliminar definitivamente"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Link href={`/quotes/${q.id}`} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-vbt-orange" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {q.status}
                  </span>
                </div>
                <p className="font-semibold text-vbt-blue text-sm">
                  {q.quoteNumber ?? q.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="font-medium text-gray-800 mt-1">{q.project.projectName}</p>
                {q.project.client?.name && <p className="text-gray-400 text-xs mt-0.5">{q.project.client.name}</p>}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{getCountryName(q.project.countryCode) || "—"}</span>
                  <span className="text-sm font-bold text-gray-800">{formatCurrency(q.totalPrice)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

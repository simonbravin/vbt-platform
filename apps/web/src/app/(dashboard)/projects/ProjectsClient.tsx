"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { FolderOpen, MapPin, User, LayoutGrid, List, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  client: string | null;
  clientRecord?: { id: string; name: string } | null;
  location: string | null;
  country?: { id: string; name: string; code: string } | null;
  status?: string;
  baselineQuote?: { id: string; quoteNumber: string | null; fobUsd: number } | null;
  wallAreaM2S80: number;
  wallAreaM2S150: number;
  wallAreaM2S200: number;
  _count: { quotes: number };
};

const statusLabel: Record<string, string> = {
  QUOTED: "Quoted",
  IN_CONVERSATION: "In conversation",
  SOLD: "Sold",
  ARCHIVED: "Archived",
};

export function ProjectsClient({ projects: initialProjects, total: initialTotal }: { projects: Project[]; total: number }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(() => {
    const q = search.trim();
    if (!q) {
      setProjects(initialProjects);
      setTotal(initialTotal);
      return;
    }
    setSearching(true);
    fetch(`/api/projects?search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setSearching(false));
  }, [search.trim(), initialProjects, initialTotal]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by project, client, location, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView("cards")}
            title="Card view"
            className={`p-2 transition-colors ${view === "cards" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("table")}
            title="Table view"
            className={`p-2 transition-colors ${view === "table" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  {p.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "SOLD" ? "bg-green-100 text-green-700" :
                      p.status === "ARCHIVED" ? "bg-gray-200 text-gray-600" :
                      p.status === "IN_CONVERSATION" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{statusLabel[p.status] ?? p.status}</span>
                  )}
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {p._count.quotes} quote{p._count.quotes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800">{p.name}</h3>
              {p.baselineQuote && (
                <p className="text-sm text-gray-600 mt-0.5">Project FOB: {formatCurrency(p.baselineQuote.fobUsd)}</p>
              )}
              {(p.clientRecord?.name ?? p.client) && (
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                  <User className="w-3.5 h-3.5" />
                  {p.clientRecord?.name ?? p.client}
                </div>
              )}
              {p.location && (
                <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {p.location}
                </div>
              )}
              {p.country && (
                <div className="text-gray-400 text-xs mt-0.5">{p.country.name}</div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                <span>VBT 80mm: {p.wallAreaM2S80.toFixed(0)} m²</span>
                <span>VBT 150mm: {p.wallAreaM2S150.toFixed(0)} m²</span>
                <span>VBT 200mm: {p.wallAreaM2S200.toFixed(0)} m²</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Country</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">FOB</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">VBT 80mm</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">VBT 150mm</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">VBT 200mm</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Quotes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-vbt-blue hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{(p.clientRecord?.name ?? p.client) ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{p.location ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{p.country?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {p.status ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === "SOLD" ? "bg-green-100 text-green-700" :
                        p.status === "ARCHIVED" ? "bg-gray-200 text-gray-600" :
                        p.status === "IN_CONVERSATION" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>{statusLabel[p.status] ?? p.status}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{p.baselineQuote ? formatCurrency(p.baselineQuote.fobUsd) : "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.wallAreaM2S80.toFixed(0)} m²</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.wallAreaM2S150.toFixed(0)} m²</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.wallAreaM2S200.toFixed(0)} m²</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{p._count.quotes}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

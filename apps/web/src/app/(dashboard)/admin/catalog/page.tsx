"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Upload, Edit, RefreshCw } from "lucide-react";

export default function CatalogPage() {
  const [pieces, setPieces] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [system, setSystem] = useState("");
  const [loading, setLoading] = useState(true);
  const [importDialog, setImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [editPiece, setEditPiece] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (q = search, sys = system) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    if (sys) params.set("system", sys);
    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then((d) => { setPieces(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (dryRun: boolean) => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/catalog/import?dryRun=${dryRun}`, { method: "POST", body: fd });
    const data = await res.json();
    setImportResult({ ...data, dryRun });
    setImporting(false);
    if (!dryRun) load();
  };

  const saveEdit = async () => {
    if (!editPiece) return;
    await fetch(`/api/catalog/${editPiece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pricePerMCored: editPiece._costEdit ?? editPiece.costs?.[0]?.pricePerMCored,
        usefulWidthMm: editPiece.usefulWidthMm,
        isActive: editPiece.isActive,
      }),
    });
    setEditPiece(null);
    load();
  };

  const SYS_COLORS: Record<string, string> = {
    S80: "bg-blue-100 text-blue-700",
    S150: "bg-green-100 text-green-700",
    S200: "bg-purple-100 text-purple-700",
  };
  const SYS_LABELS: Record<string, string> = {
    S80: "VBT 80mm",
    S150: "VBT 150mm",
    S200: "VBT 200mm",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Piece Catalog</h1>
          <p className="text-gray-500 text-sm mt-0.5">{pieces.length} pieces</p>
        </div>
        <button
          onClick={() => setImportDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          <Upload className="w-4 h-4" /> Import Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search pieces..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value, system); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          />
        </div>
        <select
          value={system}
          onChange={(e) => { setSystem(e.target.value); load(search, e.target.value); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
        >
          <option value="">All Systems</option>
          {[["S80", "VBT 80mm"], ["S150", "VBT 150mm"], ["S200", "VBT 200mm"]].map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Die #", "Canonical Name", "System", "Useful Width (mm)", "lbs/m Cored", "$/m Cored", "Active", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : pieces.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${!p.isActive ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{p.dieNumber ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 max-w-xs truncate">{p.canonicalName}</td>
                  <td className="px-3 py-2.5">
                    {p.systemCode ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SYS_COLORS[p.systemCode] ?? "bg-gray-100"}`}>
                        {SYS_LABELS[p.systemCode] ?? p.systemCode}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">{p.usefulWidthMm?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">{p.lbsPerMCored?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium">
                    {p.costs?.[0]?.pricePerMCored
                      ? `$${p.costs[0].pricePerMCored.toFixed(2)}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setEditPiece({ ...p, _costEdit: p.costs?.[0]?.pricePerMCored ?? 0 })}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Dialog */}
      {importDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg m-4">
            <h3 className="font-semibold text-lg mb-4">Import Piece Catalog (Excel)</h3>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-vbt-blue file:text-white hover:file:bg-blue-900"
            />
            {importResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm space-y-1">
                <p className="font-medium">{importResult.dryRun ? "Dry Run Preview:" : "Import Complete:"}</p>
                <p className="text-green-700">Created: {importResult.created}</p>
                <p className="text-blue-700">Updated: {importResult.updated}</p>
                <p className="text-gray-500">Unchanged: {importResult.unchanged}</p>
                <p className="text-gray-500">Total rows: {importResult.total}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setImportDialog(false); setImportResult(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleImport(true)} disabled={importing} className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50">
                {importing ? "..." : "Dry Run"}
              </button>
              <button onClick={() => handleImport(false)} disabled={importing} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50">
                {importing ? "Importing..." : "Import Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Piece Dialog */}
      {editPiece && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-4">Edit Piece</h3>
            <p className="text-gray-500 text-sm mb-4">{editPiece.canonicalName}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per m Cored (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPiece._costEdit}
                  onChange={(e) => setEditPiece((p: any) => ({ ...p, _costEdit: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Useful Width (mm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editPiece.usefulWidthMm ?? 0}
                  onChange={(e) => setEditPiece((p: any) => ({ ...p, usefulWidthMm: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditPiece(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

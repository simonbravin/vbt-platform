"use client";

import { useState, useEffect, useMemo } from "react";
import { Package, ArrowDown, ArrowUp, RefreshCw, Plus, LayoutGrid, List, Search } from "lucide-react";

type MoveType = "IN" | "OUT" | "ADJUST";

const SYSTEM_COLORS: Record<string, string> = {
  S80: "bg-blue-100 text-blue-700",
  S150: "bg-purple-100 text-purple-700",
  S200: "bg-green-100 text-green-700",
};
const SYSTEM_LABELS: Record<string, string> = {
  S80: "VBT 80mm",
  S150: "VBT 150mm",
  S200: "VBT 200mm",
};

// Linear meters for an item (qtyOnHand = units when heightMm is set)
function linearM(item: any): number {
  if (item.heightMm && item.heightMm > 0) {
    return item.qtyOnHand * (item.heightMm / 1000);
  }
  return item.qtyOnHand; // legacy: qtyOnHand already in linear m
}

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [filterText, setFilterText] = useState("");

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<any>(null);
  const [moveForm, setMoveForm] = useState({ qty: 0, type: "IN" as MoveType, note: "" });
  const [saving, setSaving] = useState(false);

  // Add item dialog
  const [addDialog, setAddDialog] = useState(false);
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedPiece, setSelectedPiece] = useState<any>(null);
  const [addForm, setAddForm] = useState({ heightM: 0, units: 0 });
  const [addSaving, setAddSaving] = useState(false);

  const reloadItems = (wid: string) => {
    setLoading(true);
    fetch(`/api/inventory?warehouseId=${wid}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => {
    fetch("/api/admin/warehouses")
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setWarehouses(list);
        if (list.length > 0) setWarehouseId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!warehouseId) return;
    reloadItems(warehouseId);
  }, [warehouseId]);

  // Catalog search in add dialog
  useEffect(() => {
    if (!addDialog || catalogSearch.trim().length < 2) { setCatalogResults([]); return; }
    const ctrl = new AbortController();
    fetch("/api/catalog?q=" + encodeURIComponent(catalogSearch), { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setCatalogResults(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [catalogSearch, addDialog]);

  // Group and filter items by piece
  const grouped = useMemo(() => {
    const lower = filterText.toLowerCase();
    const filtered = items.filter(i =>
      !filterText ||
      i.piece?.canonicalName?.toLowerCase().includes(lower) ||
      i.piece?.systemCode?.toLowerCase().includes(lower) ||
      SYSTEM_LABELS[i.piece?.systemCode]?.toLowerCase().includes(lower)
    );

    // Sort by piece name then height
    const sorted = [...filtered].sort((a, b) => {
      const na = a.piece?.canonicalName ?? "";
      const nb = b.piece?.canonicalName ?? "";
      if (na !== nb) return na.localeCompare(nb);
      return (a.heightMm ?? 0) - (b.heightMm ?? 0);
    });

    // Group by pieceId
    const map = new Map<string, any[]>();
    for (const item of sorted) {
      const key = item.piece?.id ?? item.pieceId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items, filterText]);

  const openMove = (item: any, type: MoveType) => {
    setMoveDialog(item);
    setMoveForm({ qty: 0, type, note: "" });
  };

  const submitMove = async () => {
    if (!moveDialog || moveForm.qty <= 0) return;
    setSaving(true);
    await fetch(`/api/inventory/${moveDialog.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(moveForm),
    });
    setSaving(false);
    setMoveDialog(null);
    reloadItems(warehouseId);
  };

  const openAddDialog = () => {
    setAddDialog(true);
    setCatalogSearch("");
    setCatalogResults([]);
    setSelectedPiece(null);
    setAddForm({ heightM: 0, units: 0 });
  };

  const submitAddItem = async () => {
    if (!selectedPiece || !warehouseId || addForm.units <= 0 || addForm.heightM <= 0) return;
    setAddSaving(true);
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId,
        pieceId: selectedPiece.id,
        heightMm: Math.round(addForm.heightM * 1000),
        qtyOnHand: addForm.units, // stored as units; linearM = units × heightM
      }),
    });
    setAddSaving(false);
    setAddDialog(false);
    reloadItems(warehouseId);
  };

  const computedLinearM = addForm.units > 0 && addForm.heightM > 0
    ? (addForm.units * addForm.heightM).toFixed(2)
    : null;

  const totalAllLinearM = items.reduce((acc, i) => acc + linearM(i), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {grouped.size} piece{grouped.size !== 1 ? "s" : ""} · {totalAllLinearM.toFixed(1)} linear m total
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
          >
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView("table")} title="Table view" className={`p-2 ${view === "table" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setView("cards")} title="Card view" className={`p-2 ${view === "cards" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button onClick={openAddDialog} className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by piece or system..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
        />
      </div>

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Piece", "System", "Height", "Units", "Linear m", "Reserved", "Available", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : grouped.size === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No inventory items. Use "Add Item" to create stock.</td></tr>
                ) : (
                  Array.from(grouped.entries()).map(([pieceKey, pieceItems]) => {
                    const piece = pieceItems[0].piece;
                    const totalLm = pieceItems.reduce((acc, i) => acc + linearM(i), 0);
                    const sysCode = piece?.systemCode;
                    const hasMultiple = pieceItems.length > 1;

                    return (
                      <>
                        {/* Piece group header (only if multiple heights) */}
                        {hasMultiple && (
                          <tr key={`hdr-${pieceKey}`} className="bg-gray-50 border-t border-gray-200">
                            <td className="px-4 py-2 font-semibold text-gray-800" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                {piece?.canonicalName}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-400">—</td>
                            <td className="px-4 py-2 text-xs text-gray-400 text-right">
                              {pieceItems.reduce((a, i) => a + i.qtyOnHand, 0)} units
                            </td>
                            <td className="px-4 py-2 font-semibold text-gray-700 text-right">
                              {totalLm.toFixed(1)} m
                            </td>
                            <td colSpan={3} />
                          </tr>
                        )}

                        {/* Height rows */}
                        {pieceItems.map((item, idx) => {
                          const lm = linearM(item);
                          const avail = item.qtyOnHand - item.qtyReserved;
                          return (
                            <tr key={item.id} className={`hover:bg-gray-50 border-t border-gray-50 ${hasMultiple ? "bg-white" : ""}`}>
                              <td className="px-4 py-3">
                                {!hasMultiple ? (
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <div>
                                      <p className="font-medium text-gray-800 text-xs max-w-xs truncate">{piece?.canonicalName}</p>
                                      <p className="text-gray-400 text-xs">{piece?.dieNumber ?? "—"}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs pl-6">↳ {item.heightMm ? `${(item.heightMm / 1000).toFixed(2)} m` : "—"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {!hasMultiple && sysCode ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SYSTEM_COLORS[sysCode] ?? "bg-gray-100 text-gray-600"}`}>
                                    {SYSTEM_LABELS[sysCode] ?? sysCode}
                                  </span>
                                ) : !hasMultiple ? "—" : null}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-right">
                                {!hasMultiple
                                  ? item.heightMm ? `${(item.heightMm / 1000).toFixed(2)} m` : "—"
                                  : null}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-800">
                                {item.qtyOnHand} u
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-700">
                                {lm.toFixed(1)} m
                              </td>
                              <td className="px-4 py-3 text-right text-amber-600">{item.qtyReserved.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={avail < 0 ? "text-red-600 font-semibold" : "text-green-700 font-medium"}>
                                  {avail.toFixed(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button onClick={() => openMove(item, "IN")} title="Receive" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><ArrowDown className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => openMove(item, "OUT")} title="Dispatch" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><ArrowUp className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => openMove(item, "ADJUST")} title="Adjust" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><RefreshCw className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {view === "cards" && (
        <div>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : grouped.size === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No inventory items. Use "Add Item" to create stock.</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {Array.from(grouped.entries()).map(([pieceKey, pieceItems]) => {
                const piece = pieceItems[0].piece;
                const sysCode = piece?.systemCode;
                const totalLm = pieceItems.reduce((acc, i) => acc + linearM(i), 0);
                const totalUnits = pieceItems.reduce((acc, i) => acc + i.qtyOnHand, 0);
                return (
                  <div key={pieceKey} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                      {sysCode && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SYSTEM_COLORS[sysCode] ?? "bg-gray-100 text-gray-600"}`}>
                          {SYSTEM_LABELS[sysCode] ?? sysCode}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm truncate">{piece?.canonicalName}</p>
                    {/* Heights breakdown */}
                    <div className="mt-3 space-y-1">
                      {pieceItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{item.heightMm ? `${(item.heightMm / 1000).toFixed(2)} m` : "—"}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-700">{item.qtyOnHand} u</span>
                            <span className="font-medium text-gray-800">= {linearM(item).toFixed(1)} m lin.</span>
                            <div className="flex gap-1">
                              <button onClick={() => openMove(item, "IN")} className="p-1 text-green-600 hover:bg-green-50 rounded"><ArrowDown className="w-3 h-3" /></button>
                              <button onClick={() => openMove(item, "OUT")} className="p-1 text-red-500 hover:bg-red-50 rounded"><ArrowUp className="w-3 h-3" /></button>
                              <button onClick={() => openMove(item, "ADJUST")} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><RefreshCw className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                      <span className="text-gray-500">{totalUnits} units total</span>
                      <span className="font-bold text-gray-800">{totalLm.toFixed(1)} m lin.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MOVE DIALOG */}
      {moveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4">
            <h3 className="font-semibold text-lg mb-1">
              {moveForm.type === "IN" ? "Receive Stock" : moveForm.type === "OUT" ? "Dispatch Stock" : "Adjust Stock"}
            </h3>
            <p className="text-gray-500 text-sm mb-1 truncate">{moveDialog.piece?.canonicalName}</p>
            {moveDialog.heightMm && (
              <p className="text-gray-400 text-xs mb-4">Height: {(moveDialog.heightMm / 1000).toFixed(2)} m</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity (units) *
                </label>
                <input
                  type="number" min="1" step="1"
                  value={moveForm.qty || ""}
                  onChange={e => setMoveForm(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
                {moveDialog.heightMm > 0 && moveForm.qty > 0 && (
                  <p className="text-xs text-gray-400 mt-1">= {(moveForm.qty * moveDialog.heightMm / 1000).toFixed(2)} linear m</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text" value={moveForm.note}
                  onChange={e => setMoveForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="e.g., PO#12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setMoveDialog(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={submitMove} disabled={saving || moveForm.qty <= 0} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM DIALOG */}
      {addDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-1">Add Inventory Item</h3>
            <p className="text-gray-400 text-sm mb-5">Select a piece, enter the wall height and quantity.</p>

            <div className="space-y-4">
              {/* Step 1: search piece */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  1. Search Piece *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Type piece name or code..."
                    value={catalogSearch}
                    onChange={e => {
                      setCatalogSearch(e.target.value);
                      if (selectedPiece) setSelectedPiece(null);
                    }}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                  />
                </div>
                {/* Search results */}
                {catalogResults.length > 0 && !selectedPiece && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-44 overflow-y-auto divide-y divide-gray-50 shadow-sm">
                    {catalogResults.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedPiece(c);
                          setCatalogSearch(c.canonicalName ?? c.description ?? "");
                          setCatalogResults([]);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2"
                      >
                        <span className="text-sm text-gray-800 truncate">{c.canonicalName ?? c.description}</span>
                        {c.systemCode && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${SYSTEM_COLORS[c.systemCode] ?? "bg-gray-100 text-gray-600"}`}>
                            {SYSTEM_LABELS[c.systemCode] ?? c.systemCode}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* Selected piece confirmation */}
                {selectedPiece && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-800">{selectedPiece.canonicalName}</p>
                      {selectedPiece.systemCode && (
                        <p className="text-xs text-blue-500">{SYSTEM_LABELS[selectedPiece.systemCode] ?? selectedPiece.systemCode}</p>
                      )}
                    </div>
                    <button onClick={() => { setSelectedPiece(null); setCatalogSearch(""); }} className="text-xs text-blue-400 hover:text-blue-600">Change</button>
                  </div>
                )}
              </div>

              {/* Step 2: height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. Wall Height (m) *
                </label>
                <input
                  type="number" min="0.1" step="0.05"
                  placeholder="e.g. 3.00"
                  value={addForm.heightM || ""}
                  onChange={e => setAddForm(p => ({ ...p, heightM: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>

              {/* Step 3: units */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  3. Quantity (units / panels) *
                </label>
                <input
                  type="number" min="1" step="1"
                  placeholder="e.g. 15"
                  value={addForm.units || ""}
                  onChange={e => setAddForm(p => ({ ...p, units: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>

              {/* Summary */}
              {computedLinearM && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-sm text-gray-600">
                    {addForm.units} units × {addForm.heightM} m
                  </span>
                  <span className="font-bold text-gray-800 text-base">= {computedLinearM} linear m</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setAddDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={submitAddItem}
                disabled={addSaving || !selectedPiece || addForm.units <= 0 || addForm.heightM <= 0}
                className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {addSaving ? "Adding..." : "Add to Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

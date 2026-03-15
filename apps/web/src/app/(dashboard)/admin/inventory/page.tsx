"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Package, ArrowDown, ArrowUp, RefreshCw, Plus, LayoutGrid, List, Search, ChevronDown, ChevronRight, ChevronUp, Download, ScrollText } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type MoveType = "IN" | "OUT" | "ADJUST";

const SYSTEM_COLORS: Record<string, string> = {
  S80: "bg-blue-100 text-blue-700",
  S150: "bg-purple-100 text-purple-700",
  S200: "bg-green-100 text-green-700",
};

// Linear meters for an item (qtyOnHand = units when heightMm is set)
function linearM(item: any): number {
  if (item.heightMm && item.heightMm > 0) {
    return item.qtyOnHand * (item.heightMm / 1000);
  }
  return item.qtyOnHand; // legacy: qtyOnHand already in linear m
}

export default function InventoryPage() {
  const t = useT();
  const SYSTEM_LABELS: Record<string, string> = useMemo(
    () => ({
      S80: t("admin.inventory.s80"),
      S150: t("admin.inventory.s150"),
      S200: t("admin.inventory.s200"),
    }),
    [t]
  );
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [filterText, setFilterText] = useState("");
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<any>(null);
  const [moveForm, setMoveForm] = useState({ qty: 0, type: "IN" as MoveType, note: "" });
  const [saving, setSaving] = useState(false);

  // Add item dialog
  const [addDialog, setAddDialog] = useState(false);
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [debouncedCatalogSearch, setDebouncedCatalogSearch] = useState("");
  const [selectedPiece, setSelectedPiece] = useState<any>(null);
  const [addForm, setAddForm] = useState({ heightM: 0, units: 0 });
  const [addSaving, setAddSaving] = useState(false);

  const [logsModal, setLogsModal] = useState(false);
  const [movementLogs, setMovementLogs] = useState<{ id: string; userName: string | null; createdAt: string; changeLabel: string; pieceName?: string | null; warehouseName?: string | null }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

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

  // Debounce catalog search (300 ms) so we don't hit API on every keystroke
  useEffect(() => {
    if (!addDialog) {
      setDebouncedCatalogSearch("");
      return;
    }
    const t = setTimeout(() => setDebouncedCatalogSearch(catalogSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [catalogSearch, addDialog]);

  // Catalog search in add dialog: fetch when debounced value has length >= 2; use minimal=1 for lighter response
  useEffect(() => {
    if (!addDialog || debouncedCatalogSearch.length < 2) { setCatalogResults([]); return; }
    const ctrl = new AbortController();
    const params = new URLSearchParams({ search: debouncedCatalogSearch, minimal: "1" });
    fetch("/api/catalog?" + params.toString(), { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setCatalogResults(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [debouncedCatalogSearch, addDialog]);

  // Group and filter items by piece; optionally filter to in-stock only (available > 0)
  const grouped = useMemo(() => {
    const lower = filterText.toLowerCase();
    let filtered = items.filter(i =>
      !filterText ||
      i.piece?.canonicalName?.toLowerCase().includes(lower) ||
      i.piece?.systemCode?.toLowerCase().includes(lower) ||
      SYSTEM_LABELS[i.piece?.systemCode]?.toLowerCase().includes(lower)
    );
    if (showInStockOnly) {
      filtered = filtered.filter(i => (i.qtyOnHand - (i.qtyReserved ?? 0)) > 0);
    }

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
  }, [items, filterText, showInStockOnly, SYSTEM_LABELS]);

  const totalDisplayLinearM = useMemo(() => {
    let sum = 0;
    for (const pieceItems of grouped.values()) {
      for (const item of pieceItems) sum += linearM(item);
    }
    return sum;
  }, [grouped]);

  const toggleGroup = (pieceKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(pieceKey)) next.delete(pieceKey);
      else next.add(pieceKey);
      return next;
    });
  };
  const expandCollapseAll = (expand: boolean) => {
    if (expand) setCollapsedGroups(new Set());
    else setCollapsedGroups(new Set(grouped.keys()));
  };
  const isGroupExpanded = (pieceKey: string, hasMultiple: boolean) => {
    if (!hasMultiple) return true;
    return !collapsedGroups.has(pieceKey);
  };
  const currentWarehouseName = warehouses.find(w => w.id === warehouseId)?.name ?? "";

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

  const exportCsv = () => {
    const headers = ["Piece", "Matrix", "System", "Height (m)", "Units", "Linear m", "Reserved", "Available", "Warehouse"];
    const rows: string[][] = [headers];
    for (const [_pieceKey, pieceItems] of grouped.entries()) {
      const piece = pieceItems[0].piece;
      const sysLabel = piece?.systemCode ? (SYSTEM_LABELS[piece.systemCode] ?? piece.systemCode) : "";
      const matrixVal = piece?.dieNumber ? (piece.dieNumber.startsWith("#") ? piece.dieNumber : "#" + piece.dieNumber) : "";
      for (const item of pieceItems) {
        const lm = linearM(item);
        const avail = item.qtyOnHand - (item.qtyReserved ?? 0);
        rows.push([
          piece?.canonicalName ?? "",
          matrixVal,
          sysLabel,
          item.heightMm ? (item.heightMm / 1000).toFixed(2) : "",
          String(item.qtyOnHand),
          lm.toFixed(2),
          String(item.qtyReserved ?? 0),
          avail.toFixed(1),
          currentWarehouseName,
        ]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-${currentWarehouseName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("admin.inventory.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {grouped.size} {grouped.size !== 1 ? t("admin.inventory.piecesCountPlural") : t("admin.inventory.piecesCount")} · {totalDisplayLinearM.toFixed(1)} {t("admin.inventory.linearMTotal")}
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
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <span className="px-2.5 py-1.5 text-gray-500">{t("admin.inventory.view")}</span>
            <button onClick={() => setView("table")} title={t("admin.inventory.tableView")} className={`p-2 ${view === "table" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setView("cards")} title={t("admin.inventory.cardView")} className={`p-2 ${view === "cards" ? "bg-vbt-blue text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input type="checkbox" checked={showInStockOnly} onChange={e => setShowInStockOnly(e.target.checked)} className="rounded border-gray-300 text-vbt-blue focus:ring-vbt-blue" />
            {t("admin.inventory.inStockOnly")}
          </label>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" /> {t("admin.inventory.export")}
          </button>
          <button onClick={() => { setLogsModal(true); setMovementLogs([]); setLogsLoading(true); fetch(`/api/inventory/logs?warehouseId=${warehouseId || ""}&limit=100`).then(r => r.json()).then(d => { setMovementLogs(d.logs ?? []); setLogsLoading(false); }).catch(() => setLogsLoading(false)); }} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ScrollText className="w-4 h-4" /> {t("admin.inventory.logs")}
          </button>
          <button onClick={openAddDialog} className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900">
            <Plus className="w-4 h-4" /> {t("admin.inventory.addItem")}
          </button>
        </div>
      </div>

      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t("admin.inventory.filterPlaceholder")}
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
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("admin.inventory.piece")}</span>
                      {grouped.size > 0 && (
                        <div className="flex items-center rounded border border-gray-200 overflow-hidden">
                          <button type="button" onClick={() => expandCollapseAll(true)} title={t("admin.inventory.expandAll")} className="p-0.5 text-gray-500 hover:bg-gray-100"><ChevronDown className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => expandCollapseAll(false)} title={t("admin.inventory.collapseAll")} className="p-0.5 text-gray-500 hover:bg-gray-100"><ChevronUp className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{t("admin.inventory.matrix")}</th>
                  {[t("admin.inventory.system"), t("admin.inventory.height"), t("admin.inventory.units"), t("admin.inventory.linearM"), t("admin.inventory.reserved"), t("admin.inventory.available"), t("admin.catalog.actions")].map(h => (
                    <th key={h} className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">{t("common.loading")}</td></tr>
                ) : grouped.size === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">{t("admin.inventory.noItemsAddOne")}</td></tr>
                ) : (
                  Array.from(grouped.entries()).map(([pieceKey, pieceItems]) => {
                    const piece = pieceItems[0].piece;
                    const totalLm = pieceItems.reduce((acc, i) => acc + linearM(i), 0);
                    const sysCode = piece?.systemCode;
                    const hasMultiple = pieceItems.length > 1;
                    const expanded = isGroupExpanded(pieceKey, hasMultiple);
                    const matrixVal = piece?.dieNumber ? (piece.dieNumber.startsWith("#") ? piece.dieNumber : "#" + piece.dieNumber) : "—";

                    return (
                      <React.Fragment key={pieceKey}>
                        {/* Parent row (when multiple heights: summary row; when single: the only row) */}
                        {hasMultiple && (
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <td className="px-4 py-2 font-semibold text-gray-800">
                              <div className="flex items-center gap-1.5">
                                <button type="button" onClick={() => toggleGroup(pieceKey)} className="p-0.5 rounded hover:bg-gray-200 text-gray-500" aria-label={expanded ? t("admin.inventory.collapse") : t("admin.inventory.expand")}>
                                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                {piece?.canonicalName}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-600 text-sm">{matrixVal}</td>
                            <td className="px-4 py-2 text-center">
                              {sysCode ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SYSTEM_COLORS[sysCode] ?? "bg-gray-100 text-gray-600"}`}>
                                  {SYSTEM_LABELS[sysCode] ?? sysCode}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-gray-400">—</td>
                            <td className="px-4 py-2 text-center text-gray-600">{pieceItems.reduce((a, i) => a + i.qtyOnHand, 0)} u</td>
                            <td className="px-4 py-2 text-center font-semibold text-gray-700">{totalLm.toFixed(1)} m</td>
                            <td className="px-4 py-2 text-center text-amber-600">—</td>
                            <td className="px-4 py-2 text-center">—</td>
                            <td className="px-4 py-2" />
                          </tr>
                        )}

                        {/* Height rows (or single row when !hasMultiple) */}
                        {expanded && pieceItems.map((item) => {
                          const lm = linearM(item);
                          const avail = item.qtyOnHand - (item.qtyReserved ?? 0);
                          return (
                            <tr key={item.id} className={`hover:bg-gray-50 border-t border-gray-50 ${hasMultiple ? "bg-white" : ""}`}>
                              <td className="px-4 py-2">
                                {!hasMultiple ? (
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" className="invisible w-4 p-0.5 cursor-default" aria-hidden><ChevronRight className="w-4 h-4" /></button>
                                    <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium text-gray-800 text-xs max-w-xs truncate">{piece?.canonicalName}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs pl-8">↳ {item.heightMm ? `${(item.heightMm / 1000).toFixed(2)} m` : "—"}</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-gray-500 text-xs">{!hasMultiple ? matrixVal : ""}</td>
                              <td className="px-4 py-2 text-center">
                                {sysCode ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SYSTEM_COLORS[sysCode] ?? "bg-gray-100 text-gray-600"}`}>
                                    {SYSTEM_LABELS[sysCode] ?? sysCode}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-4 py-2 text-center text-gray-600">
                                {item.heightMm ? `${(item.heightMm / 1000).toFixed(2)} m` : "—"}
                              </td>
                              <td className="px-4 py-2 text-center font-medium text-gray-800">{item.qtyOnHand} u</td>
                              <td className="px-4 py-2 text-center font-semibold text-gray-700">{lm.toFixed(1)} m</td>
                              <td className="px-4 py-2 text-center text-amber-600">{(item.qtyReserved ?? 0).toFixed(1)}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={avail < 0 ? "text-red-600 font-semibold" : "text-green-700 font-medium"}>
                                  {avail.toFixed(1)}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => openMove(item, "IN")} title="Receive" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><ArrowDown className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => openMove(item, "OUT")} title="Dispatch" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><ArrowUp className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => openMove(item, "ADJUST")} title="Adjust" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><RefreshCw className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
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
            <p className="text-gray-400 text-sm">{t("common.loading")}</p>
          ) : grouped.size === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t("admin.inventory.noItemsAddOne")}</p>
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
                      <span className="text-gray-500">{totalUnits} {t("admin.inventory.unitsTotal")}</span>
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
              {moveForm.type === "IN" ? t("admin.inventory.receive") : moveForm.type === "OUT" ? t("admin.inventory.dispatch") : t("admin.inventory.adjust")}
            </h3>
            <p className="text-gray-500 text-sm mb-1 truncate">{moveDialog.piece?.canonicalName}</p>
            {moveDialog.heightMm && (
              <p className="text-gray-400 text-xs mb-4">{t("admin.inventory.heightLabel")} {(moveDialog.heightMm / 1000).toFixed(2)} m</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("admin.inventory.quantityUnits")}
                </label>
                <input
                  type="number" min="1" step="1"
                  value={moveForm.qty || ""}
                  onChange={e => setMoveForm(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
                {moveDialog.heightMm > 0 && moveForm.qty > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{t("admin.inventory.linearMEquals", { value: (moveForm.qty * moveDialog.heightMm / 1000).toFixed(2) })}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.inventory.note")}</label>
                <input
                  type="text" value={moveForm.note}
                  onChange={e => setMoveForm(p => ({ ...p, note: e.target.value }))}
                  placeholder={t("admin.inventory.notePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setMoveDialog(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("common.cancel")}</button>
              <button onClick={submitMove} disabled={saving || moveForm.qty <= 0} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? t("common.saving") : t("admin.inventory.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGS MODAL */}
      {logsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col m-4">
            <h3 className="font-semibold text-lg mb-4">{t("admin.inventory.movementLogs")}</h3>
            {logsLoading ? (
              <p className="text-gray-500 text-sm py-8 text-center">{t("common.loading")}</p>
            ) : (
              <div className="overflow-y-auto flex-1 border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t("admin.inventory.user")}</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t("admin.inventory.dateTime")}</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t("admin.inventory.piece")}</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t("admin.inventory.warehouse")}</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t("admin.inventory.change")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementLogs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t("admin.inventory.noMovementLogs")}</td></tr>
                    ) : (
                      movementLogs.map((log) => (
                        <tr key={log.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2 text-gray-800">{log.userName ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-2 text-gray-600">{log.pieceName ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-600">{log.warehouseName ?? "—"}</td>
                          <td className="px-4 py-2 font-medium text-gray-800">{log.changeLabel}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setLogsModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">{t("admin.inventory.close")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM DIALOG */}
      {addDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-1">{t("admin.inventory.addInventoryItem")}</h3>
            <p className="text-gray-400 text-sm mb-5">{t("admin.inventory.addItemDescription")}</p>

            <div className="space-y-4">
              {/* Step 1: search piece */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  1. {t("admin.inventory.searchPiece")}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t("admin.inventory.searchPiecePlaceholder")}
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
                    <button onClick={() => { setSelectedPiece(null); setCatalogSearch(""); }} className="text-xs text-blue-400 hover:text-blue-600">{t("admin.inventory.changeButton")}</button>
                  </div>
                )}
              </div>

              {/* Step 2: height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. {t("admin.inventory.wallHeightM")}
                </label>
                <input
                  type="number" min="0.1" step="0.05"
                  placeholder={t("admin.inventory.wallHeightPlaceholder")}
                  value={addForm.heightM || ""}
                  onChange={e => setAddForm(p => ({ ...p, heightM: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>

              {/* Step 3: units */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  3. {t("admin.inventory.quantityUnitsPanels")}
                </label>
                <input
                  type="number" min="1" step="1"
                  placeholder={t("admin.inventory.quantityPlaceholder")}
                  value={addForm.units || ""}
                  onChange={e => setAddForm(p => ({ ...p, units: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>

              {/* Summary */}
              {computedLinearM && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-sm text-gray-600">
                    {addForm.units} {t("admin.inventory.unitsWord")} × {addForm.heightM} m
                  </span>
                  <span className="font-bold text-gray-800 text-base">= {computedLinearM} {t("admin.inventory.linearM")}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setAddDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("common.cancel")}</button>
              <button
                onClick={submitAddItem}
                disabled={addSaving || !selectedPiece || addForm.units <= 0 || addForm.heightM <= 0}
                className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {addSaving ? t("admin.inventory.adding") : t("admin.inventory.addToInventory")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

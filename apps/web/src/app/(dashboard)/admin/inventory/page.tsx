"use client";

import { useState, useEffect } from "react";
import { Package, ArrowDown, ArrowUp, RefreshCw } from "lucide-react";

type MoveType = "IN" | "OUT" | "ADJUST";

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [moveDialog, setMoveDialog] = useState<any>(null);
  const [moveForm, setMoveForm] = useState({ qty: 0, type: "IN" as MoveType, note: "" });
  const [saving, setSaving] = useState(false);

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
    setLoading(true);
    fetch(`/api/inventory?warehouseId=${warehouseId}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); });
  }, [warehouseId]);

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
    // reload
    setLoading(true);
    fetch(`/api/inventory?warehouseId=${warehouseId}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage stock levels per warehouse</p>
        </div>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
        >
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Piece", "System", "On Hand", "Reserved", "Available", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No inventory items found</td></tr>
              ) : items.map((item) => {
                const available = item.qtyOnHand - item.qtyReserved;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800 text-xs max-w-xs truncate">{item.piece?.canonicalName}</p>
                          <p className="text-gray-400 text-xs">{item.piece?.dieNumber ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.piece?.systemCode ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          {item.piece.systemCode}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.qtyOnHand.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{item.qtyReserved.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={available < 0 ? "text-red-600 font-semibold" : "text-green-700 font-medium"}>
                        {available.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openMove(item, "IN")}
                          title="Receive stock"
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openMove(item, "OUT")}
                          title="Dispatch stock"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openMove(item, "ADJUST")}
                          title="Adjust stock"
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {moveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4">
            <h3 className="font-semibold text-lg mb-1">
              {moveForm.type === "IN" ? "Receive Stock" : moveForm.type === "OUT" ? "Dispatch Stock" : "Adjust Stock"}
            </h3>
            <p className="text-gray-500 text-sm mb-4 truncate">{moveDialog.piece?.canonicalName}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity (linear m) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={moveForm.qty || ""}
                  onChange={(e) => setMoveForm(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={moveForm.note}
                  onChange={(e) => setMoveForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="e.g., PO#12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setMoveDialog(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={submitMove}
                disabled={saving || moveForm.qty <= 0}
                className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

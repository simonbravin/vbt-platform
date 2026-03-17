"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Warehouse, Plus, Pencil, Trash2, Package, ArrowRightLeft, Search } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Country = { id: string; code: string; name: string };
type WarehouseRow = { id: string; name: string; location: string | null; countryCode?: string | null; address?: string | null; managerName?: string | null; contactPhone?: string | null; contactEmail?: string | null; isActive: boolean };
type LevelRow = {
  id: string;
  quantity: number;
  unit: string | null;
  warehouse: { id: string; name: string };
  catalogPiece: { id: string; canonicalName: string; systemCode: string };
};
type CatalogPieceRow = { id: string; canonicalName: string; systemCode: string };
type TxRow = {
  id: string;
  quantityDelta: number;
  type: string;
  createdAt: string;
  warehouse: { name: string };
  catalogPiece: { canonicalName: string; systemCode: string };
};

const TX_TYPES: { value: string; label: string }[] = [
  { value: "purchase_in", label: "Entrada (compra)" },
  { value: "project_surplus", label: "Sobrante proyecto" },
  { value: "adjustment_in", label: "Ajuste entrada" },
  { value: "sale_out", label: "Salida (venta)" },
  { value: "project_consumption", label: "Consumo proyecto" },
  { value: "adjustment_out", label: "Ajuste salida" },
];

export function InventoryClient() {
  const t = useT();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [catalogPieces, setCatalogPieces] = useState<CatalogPieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState({ name: "", location: "", countryCode: "", address: "", managerName: "", contactPhone: "", contactEmail: "" });
  const [countries, setCountries] = useState<Country[]>([]);
  const [txForm, setTxForm] = useState({ warehouseId: "", catalogPieceId: "", quantityDelta: 0, type: "purchase_in", notes: "", referenceProjectId: "" });
  const [saving, setSaving] = useState(false);
  const [txSaving, setTxSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/saas/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []))
      .catch(() => setWarehouses([]))
      .finally(() => setLoading(false));
  }, []);

  const loadLevels = useCallback(() => {
    setLoadingLevels(true);
    fetch("/api/saas/inventory/levels?limit=300")
      .then((r) => r.json())
      .then((data) => setLevels(data.levels ?? []))
      .catch(() => setLevels([]))
      .finally(() => setLoadingLevels(false));
  }, []);

  const loadTransactions = useCallback(() => {
    fetch("/api/saas/inventory/transactions?limit=50")
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => setCatalogPieces(Array.isArray(data) ? data : []))
      .catch(() => setCatalogPieces([]));
  }, []);
  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => setCountries(Array.isArray(data) ? data : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      loadLevels();
      loadTransactions();
    }
  }, [loading, loadLevels, loadTransactions]);

  const handleCreateTransaction = () => {
    if (!txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0) return;
    const delta = ["sale_out", "project_consumption", "adjustment_out"].includes(txForm.type)
      ? -Math.abs(txForm.quantityDelta)
      : Math.abs(txForm.quantityDelta);
    setTxSaving(true);
    setError(null);
    fetch("/api/saas/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: txForm.warehouseId,
        catalogPieceId: txForm.catalogPieceId,
        quantityDelta: delta,
        type: txForm.type,
        notes: txForm.notes || undefined,
        referenceProjectId: txForm.referenceProjectId.trim() || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error ?? "Error"); });
        return r.json();
      })
      .then(() => {
        setTxForm((f) => ({ ...f, quantityDelta: 0, notes: "", referenceProjectId: "" }));
        loadLevels();
        loadTransactions();
      })
      .catch((e) => setError(e.message ?? "Error al crear transacción"))
      .finally(() => setTxSaving(false));
  };

  const openAdd = () => {
    setForm({ name: "", location: "", countryCode: "", address: "", managerName: "", contactPhone: "", contactEmail: "" });
    setEditItem(null);
    setShowAdd(true);
  };

  const openEdit = (w: WarehouseRow) => {
    setForm({
      name: w.name,
      location: w.location ?? "",
      countryCode: w.countryCode ?? "",
      address: w.address ?? "",
      managerName: w.managerName ?? "",
      contactPhone: w.contactPhone ?? "",
      contactEmail: w.contactEmail ?? "",
    });
    setEditItem(w);
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      countryCode: form.countryCode.trim() || null,
      address: form.address.trim() || null,
      managerName: form.managerName.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
    };
    try {
      if (editItem) {
        const res = await fetch(`/api/saas/warehouses/${editItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Failed to update");
          return;
        }
      } else {
        const res = await fetch("/api/saas/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Failed to create");
          return;
        }
      }
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("common.confirm") || "Confirm?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/saas/warehouses/${id}`, { method: "DELETE" });
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  };

  const filteredLevels = useMemo(() => {
    if (!searchFilter.trim()) return levels;
    const q = searchFilter.trim().toLowerCase();
    return levels.filter(
      (l) =>
        l.warehouse.name.toLowerCase().includes(q) ||
        (l.catalogPiece?.canonicalName ?? "").toLowerCase().includes(q) ||
        (l.catalogPiece?.systemCode ?? "").toLowerCase().includes(q)
    );
  }, [levels, searchFilter]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Warehouse className="w-4 h-4" /> {t("partner.settings.warehouses")}
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {warehouses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Warehouse className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">
              {t("common.noData")} {t("partner.settings.warehouses").toLowerCase()}.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-2 text-sm text-vbt-blue hover:underline"
            >
              {t("common.add")}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {warehouses.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{w.name}</p>
                  {w.location && (
                    <p className="text-xs text-gray-500">{w.location}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(w)}
                    className="p-2 text-gray-500 hover:text-vbt-blue"
                    title={t("common.edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(w.id)}
                    disabled={saving}
                    className="p-2 text-gray-500 hover:text-red-600"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4" /> Stock por bodega
          </h3>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("admin.inventory.filterPlaceholder")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAddItemForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t("admin.inventory.addItem")}
          </button>
        </div>
        {loadingLevels ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Bodega</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Pieza</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Sistema</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredLevels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {levels.length === 0
                        ? t("admin.inventory.noItemsAddOne")
                        : "Ningún resultado con el filtro."}
                    </td>
                  </tr>
                ) : (
                  filteredLevels.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 text-sm text-foreground">{l.warehouse.name}</td>
                      <td className="px-4 py-2 text-sm text-foreground">{l.catalogPiece.canonicalName}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{l.catalogPiece.systemCode}</td>
                      <td className="px-4 py-2 text-sm text-right text-foreground">{l.quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddItemForm && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> {t("admin.inventory.addItem")} — solo piezas del catálogo
            </h3>
            <button
              type="button"
              onClick={() => setShowAddItemForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("admin.inventory.close")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Elegí bodega y pieza del catálogo; tipo y cantidad definen entrada o salida.
          </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Bodega</label>
            <select
              value={txForm.warehouseId}
              onChange={(e) => setTxForm((f) => ({ ...f, warehouseId: e.target.value }))}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[140px]"
            >
              <option value="">—</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Pieza</label>
            <select
              value={txForm.catalogPieceId}
              onChange={(e) => setTxForm((f) => ({ ...f, catalogPieceId: e.target.value }))}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[160px]"
            >
              <option value="">—</option>
              {catalogPieces.map((p) => (
                <option key={p.id} value={p.id}>{p.canonicalName} ({p.systemCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
            <select
              value={txForm.type}
              onChange={(e) => setTxForm((f) => ({ ...f, type: e.target.value }))}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[140px]"
            >
              {TX_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Cantidad</label>
            <input
              type="number"
              min={0}
              step="any"
              value={txForm.quantityDelta || ""}
              onChange={(e) => setTxForm((f) => ({ ...f, quantityDelta: Number(e.target.value) || 0 }))}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-20"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ID Proyecto (opc.)</label>
            <input
              type="text"
              value={txForm.referenceProjectId}
              onChange={(e) => setTxForm((f) => ({ ...f, referenceProjectId: e.target.value }))}
              placeholder="Opcional"
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-36"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notas</label>
            <input
              type="text"
              value={txForm.notes}
              onChange={(e) => setTxForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional"
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-32"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateTransaction}
            disabled={txSaving || !txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0}
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {txSaving ? t("common.saving") : "Aplicar"}
          </button>
        </div>
        {transactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Últimos movimientos</h4>
            <ul className="space-y-1 text-sm">
              {transactions.slice(0, 10).map((tx) => (
                <li key={tx.id} className="flex flex-wrap gap-2 text-foreground">
                  <span className="font-medium">{tx.warehouse.name}</span>
                  <span>{tx.catalogPiece.canonicalName}</span>
                  <span className={tx.quantityDelta >= 0 ? "text-green-600" : "text-red-600"}>{tx.quantityDelta >= 0 ? "+" : ""}{tx.quantityDelta}</span>
                  <span className="text-muted-foreground text-xs">{tx.type}</span>
                  <span className="text-muted-foreground text-xs">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-lg mb-4">
              {editItem ? t("admin.warehouses.editTitle") : t("admin.warehouses.addTitle")}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.nameLabel")} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                  placeholder={t("admin.warehouses.namePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.locationLabel")}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                  placeholder={t("admin.warehouses.locationPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.country")}</label>
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.address")}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                  placeholder={t("admin.warehouses.addressPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.managerName")}</label>
                <input
                  type="text"
                  value={form.managerName}
                  onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                  placeholder={t("admin.warehouses.managerPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.contactPhone")}</label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                  placeholder={t("admin.warehouses.contactPhonePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.contactEmail")}</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
                  placeholder={t("admin.warehouses.contactEmailPlaceholder")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-vbt-blue/90 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

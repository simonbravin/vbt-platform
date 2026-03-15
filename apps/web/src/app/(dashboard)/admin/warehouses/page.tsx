"use client";

import { useState, useEffect } from "react";
import { Warehouse, Plus, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/context";

export default function WarehousesPage() {
  const t = useT();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", location: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/warehouses").then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ name: "", location: "" });
    setEditItem(null);
    setShowAdd(true);
  };

  const openEdit = (w: any) => {
    setForm({ name: w.name, location: w.location ?? "" });
    setEditItem(w);
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editItem) {
      await fetch(`/api/admin/warehouses/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false);
    setShowAdd(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("admin.warehouses.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{warehouses.length} {t("admin.warehouses.locationsCount")}</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Plus className="w-4 h-4" /> {t("admin.warehouses.add")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {warehouses.map((w) => (
          <div key={w.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Warehouse className="w-5 h-5 text-vbt-orange" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{w.name}</p>
                  {w.location && <p className="text-gray-400 text-sm">{w.location}</p>}
                  <p className="text-gray-400 text-xs mt-1">
                    {w._count?.items ?? 0} {t("admin.warehouses.skus")} · {w._count?.movesFrom ?? 0} {t("admin.warehouses.moves")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openEdit(w)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4">
            <h3 className="font-semibold text-lg mb-4">{editItem ? t("admin.warehouses.editTitle") : t("admin.warehouses.addTitle")}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.nameLabel")}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t("admin.warehouses.namePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.locationLabel")}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder={t("admin.warehouses.locationPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("common.cancel")}</button>
              <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

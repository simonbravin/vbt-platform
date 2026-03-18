"use client";

import { useState, useEffect } from "react";
import { Warehouse, Plus, Pencil, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Country = { id: string; code: string; name: string };

export default function WarehousesPage() {
  const t = useT();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", location: "", countryCode: "", address: "", managerName: "", contactPhone: "", contactEmail: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = () => {
    fetch("/api/admin/warehouses").then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch("/api/countries").then(r => r.json()).then(d => setCountries(Array.isArray(d) ? d : []));
  }, []);

  const openAdd = () => {
    setForm({ name: "", location: "", countryCode: "", address: "", managerName: "", contactPhone: "", contactEmail: "" });
    setEditItem(null);
    setShowAdd(true);
  };

  const openEdit = (w: any) => {
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
    if (!form.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      location: form.location || undefined,
      countryCode: form.countryCode || undefined,
      address: form.address || undefined,
      managerName: form.managerName || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
    };
    try {
      if (editItem) {
        await fetch(`/api/admin/warehouses/${editItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/admin/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/warehouses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      load();
    } finally {
      setSaving(false);
    }
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
                  {(w.location || w.address) && (
                    <p className="text-gray-400 text-sm">{[w.location, w.address].filter(Boolean).join(" · ")}</p>
                  )}
                  {w.managerName && <p className="text-gray-400 text-xs mt-0.5">{t("admin.warehouses.manager")}: {w.managerName}</p>}
                  {(w.contactPhone || w.contactEmail) && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      {[w.contactPhone, w.contactEmail].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(w)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    title={t("common.edit")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(w)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    title={t("common.delete")}
                    disabled={saving}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.country")}</label>
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm(p => ({ ...p, countryCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
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
                  onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder={t("admin.warehouses.addressPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.managerName")}</label>
                <input
                  type="text"
                  value={form.managerName}
                  onChange={(e) => setForm(p => ({ ...p, managerName: e.target.value }))}
                  placeholder={t("admin.warehouses.managerPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.contactPhone")}</label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                  placeholder={t("admin.warehouses.contactPhonePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.warehouses.contactEmail")}</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                  placeholder={t("admin.warehouses.contactEmailPlaceholder")}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("admin.warehouses.deleteConfirmTitle")}
        description={deleteTarget ? t("admin.warehouses.deleteConfirmMessage").replace("{{name}}", deleteTarget.name) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("common.deleting")}
        variant="danger"
        loading={saving}
        onConfirm={remove}
      />
    </div>
  );
}

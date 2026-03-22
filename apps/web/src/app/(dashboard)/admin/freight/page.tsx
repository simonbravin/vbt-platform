"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Ship } from "lucide-react";
import { useT } from "@/lib/i18n/context";

export default function FreightPage() {
  const t = useT();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    countryId: "",
    freightPerContainer: 0,
    isDefault: false,
    expiryDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/freight").then(r => r.json()).then(d => setProfiles(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    load();
    fetch("/api/countries").then(r => r.json()).then(d => setCountries(Array.isArray(d) ? d : []));
  }, []);

  const openAdd = () => {
    setSaveError(null);
    setForm({ name: "", countryId: "", freightPerContainer: 0, isDefault: false, expiryDate: "", notes: "" });
    setEditItem(null);
    setShowAdd(true);
  };

  const openEdit = (p: any) => {
    setSaveError(null);
    setForm({
      name: p.name,
      countryId: p.countryId ?? "",
      freightPerContainer: p.freightPerContainer ?? 0,
      isDefault: p.isDefault ?? false,
      expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().slice(0, 10) : "",
      notes: p.notes ?? "",
    });
    setEditItem(p);
    setShowAdd(true);
  };

  const getStatus = (p: { expiryDate?: string | null }) => {
    if (!p.expiryDate) return { label: t("admin.freight.statusActive"), className: "bg-green-100 text-green-700" };
    const exp = new Date(p.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    return exp < today ? { label: t("admin.freight.statusExpired"), className: "bg-amber-100 text-amber-800" } : { label: t("admin.freight.statusActive"), className: "bg-green-100 text-green-700" };
  };

  const save = async () => {
    if (!form.name || !form.countryId) return;
    setSaving(true);
    setSaveError(null);
    const payload = { ...form, expiryDate: form.expiryDate ? form.expiryDate : (editItem ? null : undefined) };
    try {
      const res = editItem
        ? await fetch(`/api/freight/${editItem.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/freight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Failed to save");
        return;
      }
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

  const tableHeaders = [t("admin.freight.profile"), t("admin.freight.country"), t("admin.freight.costPerContainer"), t("admin.freight.expiryDate"), t("admin.freight.status"), t("admin.freight.default"), t("admin.freight.actions")];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("admin.freight.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("admin.freight.subtitle")}</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Plus className="w-4 h-4" /> {t("admin.freight.add")}
        </button>
      </div>

      <div className="surface-card-overflow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {tableHeaders.map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t("admin.freight.noProfiles")}</td></tr>
            ) : profiles.map((p) => {
              const status = getStatus(p);
              return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Ship className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">{p.name}</p>
                      {p.notes && <p className="text-gray-400 text-xs truncate max-w-xs">{p.notes}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.country?.name ?? "—"}</td>
                <td className="px-4 py-3 font-medium">
                  {p.freightPerContainer != null ? fmt(p.freightPerContainer) : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>{status.label}</span>
                </td>
                <td className="px-4 py-3">
                  {p.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{t("admin.freight.default")}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="m-4 w-full max-w-md rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60">
            <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{editItem ? t("admin.freight.editTitle") : t("admin.freight.addTitle")}</h3>
            {saveError && (
              <div className="mb-4 rounded-sm border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {saveError}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.taxes.nameLabel")}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={t("admin.freight.namePlaceholder")}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.taxes.countryLabel")}</label>
                  <select
                    value={form.countryId}
                    onChange={(e) => setForm(p => ({ ...p, countryId: e.target.value }))}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">{t("admin.taxes.selectOption")}</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.freight.costPerContainerUsd")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.freightPerContainer || ""}
                      onChange={(e) => setForm(p => ({ ...p, freightPerContainer: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-sm border border-input bg-background py-2 pl-6 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.freight.expiryDate")}</label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">{t("admin.freight.carrierValidity")}</p>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.freight.notesLabel")}</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder={t("admin.freight.notesPlaceholder")}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={form.isDefault}
                    onChange={(e) => setForm(p => ({ ...p, isDefault: e.target.checked }))}
                    className="rounded-sm border-input"
                  />
                  <label htmlFor="isDefault" className="text-sm text-muted-foreground">{t("admin.freight.setDefault")}</label>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-sm border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-muted">{t("common.cancel")}</button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !form.name || !form.countryId}
                className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
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

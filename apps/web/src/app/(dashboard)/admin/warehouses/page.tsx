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
          <h1 className="text-2xl font-bold text-foreground">{t("admin.warehouses.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{warehouses.length} {t("admin.warehouses.locationsCount")}</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-sm text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> {t("admin.warehouses.add")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {warehouses.map((w) => (
          <div key={w.id} className="surface-card p-4">
              <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10">
                  <Warehouse className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{w.name}</p>
                  {(w.location || w.address) && (
                    <p className="text-muted-foreground/70 text-sm">{[w.location, w.address].filter(Boolean).join(" · ")}</p>
                  )}
                  {w.managerName && <p className="text-muted-foreground/70 text-xs mt-0.5">{t("admin.warehouses.manager")}: {w.managerName}</p>}
                  {(w.contactPhone || w.contactEmail) && (
                    <p className="text-muted-foreground/70 text-xs mt-0.5">
                      {[w.contactPhone, w.contactEmail].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(w)}
                    className="p-1.5 text-muted-foreground/70 hover:text-muted-foreground rounded-sm"
                    title={t("common.edit")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(w)}
                    className="p-1.5 text-muted-foreground/70 hover:text-destructive rounded-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="m-4 w-full max-w-sm rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60">
            <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{editItem ? t("admin.warehouses.editTitle") : t("admin.warehouses.addTitle")}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.nameLabel")}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t("admin.warehouses.namePlaceholder")}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.locationLabel")}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder={t("admin.warehouses.locationPlaceholder")}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.country")}</label>
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm(p => ({ ...p, countryCode: e.target.value }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.address")}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder={t("admin.warehouses.addressPlaceholder")}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.managerName")}</label>
                <input
                  type="text"
                  value={form.managerName}
                  onChange={(e) => setForm(p => ({ ...p, managerName: e.target.value }))}
                  placeholder={t("admin.warehouses.managerPlaceholder")}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.contactPhone")}</label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                  placeholder={t("admin.warehouses.contactPhonePlaceholder")}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.warehouses.contactEmail")}</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                  placeholder={t("admin.warehouses.contactEmailPlaceholder")}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-sm border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-muted">{t("common.cancel")}</button>
              <button type="button" onClick={save} disabled={saving || !form.name} className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
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

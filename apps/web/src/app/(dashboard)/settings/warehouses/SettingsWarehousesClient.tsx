"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Warehouse, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Country = { id: string; code: string; name: string };

export default function SettingsWarehousesClient() {
  const t = useT();
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; location?: string | null; countryCode?: string | null; address?: string | null; managerName?: string | null; contactPhone?: string | null; contactEmail?: string | null }[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<typeof warehouses[0] | null>(null);
  const [form, setForm] = useState({ name: "", location: "", countryCode: "", address: "", managerName: "", contactPhone: "", contactEmail: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<typeof warehouses[0] | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/saas/warehouses")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(t("partner.settings.warehouses.loadFailed")))))
      .then((d) => setWarehouses(Array.isArray(d?.warehouses) ? d.warehouses : []))
      .catch(() => setError(t("partner.settings.warehouses.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [t]);
  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((d) => setCountries(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setForm({ name: "", location: "", countryCode: "", address: "", managerName: "", contactPhone: "", contactEmail: "" });
    setEditItem(null);
    setShowAdd(true);
  };

  const openEdit = (w: typeof warehouses[0]) => {
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
      location: form.location || undefined,
      countryCode: form.countryCode || undefined,
      address: form.address || undefined,
      managerName: form.managerName || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
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
          throw new Error(data?.error ?? t("partner.settings.warehouses.saveFailed"));
        }
      } else {
        const res = await fetch("/api/saas/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? t("partner.settings.warehouses.createFailed"));
        }
      }
      setShowAdd(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("partner.settings.warehouses.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (w: typeof warehouses[0]) => {
    setDeleteTarget(w);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/saas/warehouses/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("partner.settings.warehouses.deleteRequestFailed"));
      setDeleteTarget(null);
      load();
    } catch {
      setError(t("partner.settings.warehouses.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="p-2 rounded-lg border border-border hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">{t("partner.settings.warehouses")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("partner.settings.warehousesDescription")}</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> {t("admin.warehouses.add")}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {warehouses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Warehouse className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm">{t("common.noData")} {t("partner.settings.warehouses").toLowerCase()}.</p>
              <button
                type="button"
                onClick={openAdd}
                className="mt-3 text-sm text-primary hover:underline"
              >
                {t("common.add")}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {warehouses.map((w) => (
                <li key={w.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">{w.name}</p>
                    {(w.location || w.address) && (
                      <p className="text-xs text-muted-foreground">{[w.location, w.address].filter(Boolean).join(" · ")}</p>
                    )}
                    {w.managerName && <p className="text-xs text-muted-foreground">{t("admin.warehouses.manager")}: {w.managerName}</p>}
                    {(w.contactPhone || w.contactEmail) && (
                      <p className="text-xs text-muted-foreground">{[w.contactPhone, w.contactEmail].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEdit(w)} className="p-2 text-muted-foreground hover:text-primary" title={t("common.edit")}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(w)}
                      disabled={saving}
                      className="p-2 text-muted-foreground hover:text-destructive"
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
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
            <h3 className="font-semibold text-lg mb-4 text-foreground">
              {editItem ? t("admin.warehouses.editTitle") : t("admin.warehouses.addTitle")}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.nameLabel")} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary"
                  placeholder={t("admin.warehouses.namePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.locationLabel")}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  placeholder={t("admin.warehouses.locationPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.country")}</label>
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.address")}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  placeholder={t("admin.warehouses.addressPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.managerName")}</label>
                <input
                  type="text"
                  value={form.managerName}
                  onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  placeholder={t("admin.warehouses.managerPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.contactPhone")}</label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  placeholder={t("admin.warehouses.contactPhonePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("admin.warehouses.contactEmail")}</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  placeholder={t("admin.warehouses.contactEmailPlaceholder")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                {t("common.cancel")}
              </button>
              <button type="button" onClick={save} disabled={saving || !form.name.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Entity = { id: string; name: string; slug: string; isActive: boolean };

/** `platform`: superadmin must choose a partner (query + POST body). `tenant`: session org (e.g. future partner admin). */
export function EntitiesClient({ scope = "tenant" }: { scope?: "tenant" | "platform" }) {
  const t = useT();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addSlug, setAddSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (scope === "platform" && !organizationId) {
      setEntities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ includeInactive: "1" });
    if (scope === "platform" && organizationId) params.set("organizationId", organizationId);
    fetch(`/api/sales/entities?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setEntities(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [scope, organizationId]);

  useEffect(() => {
    if (scope === "platform") {
      fetch("/api/saas/partners?limit=200")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          d?.partners &&
          setPartners(d.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
        )
        .catch(() => {});
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editId) {
      const e = entities.find((x) => x.id === editId);
      if (e) {
        setEditName(e.name);
        setEditSlug(e.slug);
        setEditActive(e.isActive);
      }
    }
  }, [editId, entities]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!addName.trim() || !addSlug.trim()) {
      setError(t("admin.entities.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          slug: addSlug.trim(),
          ...(scope === "platform" && organizationId ? { organizationId } : {}),
        }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t("admin.entities.failedToAdd"));
      setAddOpen(false);
      setAddName("");
      setAddSlug("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("admin.entities.failedToAdd"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/entities/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim(),
          isActive: editActive,
        }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t("admin.entities.failedToUpdate"));
      setEditId(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("admin.entities.failedToUpdate"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {scope === "platform" && (
        <div className="max-w-md">
          <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.entities.partnerLabel")}</label>
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="input-native"
          >
            <option value="">{t("admin.entities.selectPartner")}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{t("admin.entities.partnerHint")}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.entities.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("admin.entities.subtitle")}</p>
        </div>
        <button
          type="button"
          disabled={scope === "platform" && !organizationId}
          onClick={() => { setAddOpen(true); setError(null); }}
          className="inline-flex items-center gap-2 rounded-sm border border-vbt-orange/30 bg-vbt-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> {t("admin.entities.addEntity")}
        </button>
      </div>

      <div className="surface-card-overflow">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("admin.entities.name")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("admin.entities.slug")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t("admin.entities.status")}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">{t("admin.entities.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {entities.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {t("admin.entities.noEntitiesYet")}
                </td>
              </tr>
            ) : (
              entities.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{e.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.isActive ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
                      {e.isActive ? t("admin.countries.active") : t("admin.countries.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditId(e.id)}
                      className="p-2 text-muted-foreground hover:text-primary"
                      title={t("admin.entities.editTitle")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => !saving && setAddOpen(false)}>
          <div className="surface-modal max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-semibold text-foreground">{t("admin.entities.addEntityTitle")}</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.entities.nameLabel")}</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={t("admin.entities.namePlaceholder")}
                  className="input-native"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.entities.slugLabel")}</label>
                <input
                  type="text"
                  value={addSlug}
                  onChange={(e) => setAddSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  placeholder={t("admin.entities.slugPlaceholder")}
                  className="input-native font-mono"
                  required
                />
                <p className="mt-0.5 text-xs text-muted-foreground">{t("admin.entities.slugHint")}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="rounded-sm border border-vbt-orange/30 bg-vbt-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? t("common.saving") : t("common.save")}
                </button>
                <button type="button" onClick={() => !saving && setAddOpen(false)} className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40">
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => !saving && setEditId(null)}>
          <div className="surface-modal max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-semibold text-foreground">{t("admin.entities.editEntityTitle")}</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.entities.nameLabel")}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-native"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("admin.entities.slugLabel")}</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  className="input-native font-mono"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded-sm border-input"
                />
                <label htmlFor="edit-active" className="text-sm text-foreground">{t("admin.entities.activeInDropdowns")}</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="rounded-sm border border-vbt-orange/30 bg-vbt-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? t("common.saving") : t("common.save")}
                </button>
                <button type="button" onClick={() => !saving && setEditId(null)} className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40">
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

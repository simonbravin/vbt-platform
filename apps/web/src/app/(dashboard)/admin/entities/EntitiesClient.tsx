"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Entity = { id: string; name: string; slug: string; isActive: boolean };

export function EntitiesClient() {
  const t = useT();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addSlug, setAddSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/sales/entities")
      .then((r) => r.json())
      .then((d) => {
        setEntities(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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
        body: JSON.stringify({ name: addName.trim(), slug: addSlug.trim() }),
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

  if (loading) return <div className="p-8 text-center text-gray-500">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("admin.entities.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("admin.entities.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => { setAddOpen(true); setError(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          <Plus className="w-4 h-4" /> {t("admin.entities.addEntity")}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("admin.entities.name")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("admin.entities.slug")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("admin.entities.status")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("admin.entities.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entities.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  {t("admin.entities.noEntitiesYet")}
                </td>
              </tr>
            ) : (
              entities.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {e.isActive ? t("admin.countries.active") : t("admin.countries.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditId(e.id)}
                      className="p-2 text-gray-400 hover:text-vbt-orange"
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">{t("admin.entities.addEntityTitle")}</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.entities.nameLabel")}</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={t("admin.entities.namePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.entities.slugLabel")}</label>
                <input
                  type="text"
                  value={addSlug}
                  onChange={(e) => setAddSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  placeholder={t("admin.entities.slugPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  required
                />
                <p className="text-xs text-gray-500 mt-0.5">{t("admin.entities.slugHint")}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? t("common.saving") : t("common.save")}
                </button>
                <button type="button" onClick={() => !saving && setAddOpen(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium">
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => !saving && setEditId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">{t("admin.entities.editEntityTitle")}</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.entities.nameLabel")}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin.entities.slugLabel")}</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="edit-active" className="text-sm text-gray-700">{t("admin.entities.activeInDropdowns")}</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? t("common.saving") : t("common.save")}
                </button>
                <button type="button" onClick={() => !saving && setEditId(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium">
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

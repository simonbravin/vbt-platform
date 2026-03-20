"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Pencil, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type DocumentCategory = { id: string; name: string; code: string };
type DocumentItem = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  visibility: string;
  countryScope: string | null;
  categoryId: string;
  category?: { id: string; name: string; code: string };
};

const VISIBILITY_OPTIONS = ["public", "partners_only", "internal"] as const;

function visibilityOptionLabel(t: (key: string) => string, v: string) {
  const key = `superadmin.documents.visibility.${v}`;
  const out = t(key);
  return out === key ? v : out;
}

export function DocumentsAdminClient() {
  const t = useT();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ categoryId: "", visibility: "" });
  const [formOpen, setFormOpen] = useState<"new" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    fileUrl: "",
    visibility: "partners_only" as (typeof VISIBILITY_OPTIONS)[number],
    countryScope: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/saas/documents/categories");
    if (!res.ok) return;
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.visibility) params.set("visibility", filters.visibility);
    params.set("limit", "100");
    try {
      const res = await fetch(`/api/saas/documents?${params}`);
      if (!res.ok) {
        setError(t("superadmin.documents.failedToLoad"));
        return;
      }
      const data = await res.json();
      setDocuments(data.documents ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError(t("superadmin.documents.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [filters.categoryId, filters.visibility, t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openNew = () => {
    setForm({
      title: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      fileUrl: "",
      visibility: "partners_only",
      countryScope: "",
    });
    setFormError(null);
    setFormOpen("new");
    setEditingId(null);
  };

  const openEdit = (doc: DocumentItem) => {
    setForm({
      title: doc.title,
      description: doc.description ?? "",
      categoryId: doc.categoryId,
      fileUrl: doc.fileUrl,
      visibility: doc.visibility as (typeof VISIBILITY_OPTIONS)[number],
      countryScope: doc.countryScope ?? "",
    });
    setFormError(null);
    setFormOpen(null);
    setEditingId(doc.id);
  };

  const closeForm = () => {
    setFormOpen(null);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        categoryId: form.categoryId || undefined,
        fileUrl: form.fileUrl.trim(),
        visibility: form.visibility,
        countryScope: form.countryScope.trim() || null,
      };
      if (editingId) {
        const res = await fetch(`/api/saas/documents/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError(err?.error ?? t("superadmin.documents.updateFailed"));
          return;
        }
      } else {
        if (!payload.categoryId) {
          setFormError(t("superadmin.documents.categoryRequired"));
          setSaving(false);
          return;
        }
        const res = await fetch("/api/saas/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError(err?.error ?? t("superadmin.documents.createFailed"));
          return;
        }
      }
      closeForm();
      fetchDocuments();
    } catch {
      setFormError(t("superadmin.documents.requestFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">{t("superadmin.documents.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filters.visibility}
            onChange={(e) => setFilters((f) => ({ ...f, visibility: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">{t("superadmin.documents.allVisibility")}</option>
            {VISIBILITY_OPTIONS.map((v) => (
              <option key={v} value={v}>{visibilityOptionLabel(t, v)}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90"
        >
          <Plus className="h-4 w-4" />
          {t("superadmin.documents.newDocumentButton")}
        </button>
      </div>

      {(formOpen === "new" || editingId) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? t("superadmin.documents.editDocument") : t("superadmin.documents.newDocument")}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldTitle")}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldDescription")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldCategory")}</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">{t("superadmin.documents.selectCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldFileUrl")}</label>
              <input
                type="url"
                value={form.fileUrl}
                onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                required
                placeholder={t("superadmin.documents.placeholderFileUrl")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldVisibility")}</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as (typeof VISIBILITY_OPTIONS)[number] }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {VISIBILITY_OPTIONS.map((v) => (
                  <option key={v} value={v}>{visibilityOptionLabel(t, v)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldCountryScope")}</label>
              <input
                type="text"
                value={form.countryScope}
                onChange={(e) => setForm((f) => ({ ...f, countryScope: e.target.value }))}
                placeholder={t("superadmin.documents.countryScopePlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50"
              >
                {saving ? t("common.saving") : editingId ? t("superadmin.documents.buttonUpdate") : t("superadmin.documents.buttonCreate")}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-amber-50 text-amber-800 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">{t("superadmin.documents.loadingDocuments")}</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">{t("superadmin.documents.noDocumentsYet")}</p>
            <p className="text-sm text-gray-500 mt-1">{t("superadmin.documents.addDocumentHint")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("superadmin.documents.fieldTitle")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("superadmin.documents.colCategory")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("superadmin.documents.colVisibility")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("superadmin.documents.colCountry")}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t("superadmin.documents.colActions")}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <a
                        href={doc.fileUrl ? `/api/saas/documents/${doc.id}/file` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 hover:text-vbt-blue flex items-center gap-1"
                      >
                        {doc.title}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{doc.category?.name ?? doc.categoryId}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{visibilityOptionLabel(t, doc.visibility)}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{doc.countryScope ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(doc)}
                        className="text-gray-500 hover:text-vbt-blue p-1"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && documents.length > 0 && (
          <p className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100">
            {t("superadmin.documents.totalCount", { count: total })}
          </p>
        )}
      </div>
    </div>
  );
}

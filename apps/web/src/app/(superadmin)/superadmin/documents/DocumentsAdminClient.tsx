"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Pencil, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type DocumentCategory = { id: string; name: string; code: string };
type PartnerOption = { id: string; name: string };
type DocumentItem = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  visibility: string;
  countryScope: string | null;
  categoryId: string;
  organizationId?: string | null;
  allowedOrganizationIds?: string[];
  category?: { id: string; name: string; code: string };
};

function parseApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err !== "object" || err === null) return fallback;
  const e = err as { error?: unknown };
  if (typeof e.error === "string") return e.error;
  if (typeof e.error === "object" && e.error !== null && "message" in e.error) {
    const m = (e.error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

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
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [editingDocumentOrgId, setEditingDocumentOrgId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    fileUrl: "",
    visibility: "partners_only" as (typeof VISIBILITY_OPTIONS)[number],
    countryScope: "",
    allowedOrganizationIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/saas/documents/categories");
    if (!res.ok) return;
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  }, []);

  const fetchPartners = useCallback(async () => {
    const res = await fetch("/api/saas/partners?limit=500");
    if (!res.ok) return;
    const data = await res.json();
    const list = data.partners ?? [];
    setPartners(
      Array.isArray(list)
        ? list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        : []
    );
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
    fetchPartners();
  }, [fetchCategories, fetchPartners]);

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
      allowedOrganizationIds: [],
    });
    setFormError(null);
    setFormOpen("new");
    setEditingId(null);
    setEditingDocumentOrgId(null);
  };

  const openEdit = (doc: DocumentItem) => {
    setForm({
      title: doc.title,
      description: doc.description ?? "",
      categoryId: doc.categoryId,
      fileUrl: doc.fileUrl,
      visibility: doc.visibility as (typeof VISIBILITY_OPTIONS)[number],
      countryScope: doc.countryScope ?? "",
      allowedOrganizationIds: [...(doc.allowedOrganizationIds ?? [])],
    });
    setFormError(null);
    setFormOpen(null);
    setEditingId(doc.id);
    setEditingDocumentOrgId(doc.organizationId ?? null);
  };

  const closeForm = () => {
    setFormOpen(null);
    setEditingId(null);
    setEditingDocumentOrgId(null);
    setUploadError(null);
  };

  const isPlatformDocumentForm = editingDocumentOrgId === null;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/saas/documents/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(parseApiErrorMessage(data, t("superadmin.documents.uploadFailed")));
        return;
      }
      if (typeof data?.url === "string" && data.url) {
        setForm((f) => ({ ...f, fileUrl: data.url }));
      }
    } catch {
      setUploadError(t("superadmin.documents.uploadFailed"));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.fileUrl.trim()) {
      setFormError(t("superadmin.documents.fileOrKeyRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        categoryId: form.categoryId || undefined,
        fileUrl: form.fileUrl.trim(),
        visibility: form.visibility,
        countryScope: form.countryScope.trim() || null,
      };
      if (isPlatformDocumentForm) {
        payload.allowedOrganizationIds = form.allowedOrganizationIds;
      }
      if (editingId) {
        const res = await fetch(`/api/saas/documents/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError(parseApiErrorMessage(err, t("superadmin.documents.updateFailed")));
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
          setFormError(parseApiErrorMessage(err, t("superadmin.documents.createFailed")));
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldFileOrUrl")}</label>
              <p className="text-xs text-gray-500 mb-2">{t("superadmin.documents.fileOrUrlHint")}</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                  <input type="file" className="sr-only" onChange={onPickFile} disabled={uploadingFile || saving} />
                  {uploadingFile ? t("superadmin.documents.uploading") : t("superadmin.documents.uploadFileButton")}
                </label>
              </div>
              {uploadError && <p className="text-sm text-red-600 mb-2">{uploadError}</p>}
              <input
                type="text"
                value={form.fileUrl}
                onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder={t("superadmin.documents.placeholderFileUrl")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldVisibility")}</label>
              <p className="text-xs text-gray-500 mb-2">{t("superadmin.documents.visibilityHint")}</p>
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
            {isPlatformDocumentForm && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("superadmin.documents.fieldPartnerAllowlist")}</label>
                <p className="text-xs text-gray-500 mb-2">{t("superadmin.documents.partnerAllowlistHint")}</p>
                {partners.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t("superadmin.documents.partnersLoadEmpty")}</p>
                ) : (
                  <>
                    <select
                      multiple
                      size={Math.min(10, Math.max(4, partners.length))}
                      value={form.allowedOrganizationIds}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                        setForm((f) => ({ ...f, allowedOrganizationIds: selected }));
                      }}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm min-h-[120px]"
                    >
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, allowedOrganizationIds: [] }))}
                        className="text-sm text-vbt-blue hover:underline"
                      >
                        {t("superadmin.documents.clearPartnerSelection")}
                      </button>
                      <span className="text-xs text-gray-500">
                        {form.allowedOrganizationIds.length === 0
                          ? t("superadmin.documents.allPartners")
                          : t("superadmin.documents.selectedPartnersCount", { count: form.allowedOrganizationIds.length })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
            {!isPlatformDocumentForm && (
              <p className="text-sm text-gray-500 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                {t("superadmin.documents.partnerOwnedDocHint")}
              </p>
            )}
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
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("superadmin.documents.colPartners")}</th>
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
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {doc.organizationId
                        ? t("superadmin.documents.oneOrganizationDoc")
                        : (doc.allowedOrganizationIds?.length ?? 0) === 0
                          ? t("superadmin.documents.allPartners")
                          : t("superadmin.documents.selectedPartnersCount", { count: doc.allowedOrganizationIds?.length ?? 0 })}
                    </td>
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

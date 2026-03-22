"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, FileText, Pencil, ExternalLink, Search, LayoutGrid, LayoutList } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { documentMatchesSearchQuery } from "@/lib/documents-list-utils";

const VIEW_STORAGE_KEY = "vbt-documents-view-superadmin";

type ViewMode = "table" | "cards";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_STORAGE_KEY);
      if (v === "table" || v === "cards") setViewMode(v);
    } catch {
      /* ignore */
    }
  }, []);

  const setView = (m: ViewMode) => {
    setViewMode(m);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) =>
      documentMatchesSearchQuery(searchQuery, [
        doc.title,
        doc.description,
        doc.category?.name,
        doc.category?.code,
        doc.countryScope,
        doc.visibility,
        visibilityOptionLabel(t, doc.visibility),
        doc.organizationId ?? "",
        ...(doc.allowedOrganizationIds ?? []),
      ])
    );
  }, [documents, searchQuery, t]);

  const hasSearch = searchQuery.trim().length > 0;

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

  useEffect(() => {
    if (formOpen !== "new") return;
    setForm((f) => {
      if (f.categoryId || !categories[0]?.id) return f;
      return { ...f, categoryId: categories[0].id };
    });
  }, [categories, formOpen]);

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
            className="min-w-[160px] rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("superadmin.documents.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filters.visibility}
            onChange={(e) => setFilters((f) => ({ ...f, visibility: e.target.value }))}
            className="min-w-[140px] rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("superadmin.documents.newDocumentButton")}
        </button>
      </div>

      {(formOpen === "new" || editingId) && (
        <div className="surface-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            {editingId ? t("superadmin.documents.editDocument") : t("superadmin.documents.newDocument")}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            {formError && (
              <p className="rounded-sm border border-alert-errorBorder bg-alert-error px-3 py-2 text-sm text-foreground">{formError}</p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldTitle")}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="input-native"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldDescription")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="input-native"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldCategory")}</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                required
                className="input-native"
              >
                <option value="">{t("superadmin.documents.selectCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldFileOrUrl")}</label>
              <p className="mb-2 text-xs text-muted-foreground">{t("superadmin.documents.fileOrUrlHint")}</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-input bg-muted/40 px-3 py-2 text-sm hover:bg-muted/60">
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
                className="input-native font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldVisibility")}</label>
              <p className="mb-2 text-xs text-muted-foreground">{t("superadmin.documents.visibilityHint")}</p>
              <select
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as (typeof VISIBILITY_OPTIONS)[number] }))}
                className="input-native"
              >
                {VISIBILITY_OPTIONS.map((v) => (
                  <option key={v} value={v}>{visibilityOptionLabel(t, v)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldCountryScope")}</label>
              <input
                type="text"
                value={form.countryScope}
                onChange={(e) => setForm((f) => ({ ...f, countryScope: e.target.value }))}
                placeholder={t("superadmin.documents.countryScopePlaceholder")}
                className="input-native"
              />
            </div>
            {isPlatformDocumentForm && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("superadmin.documents.fieldPartnerAllowlist")}</label>
                <p className="mb-2 text-xs text-muted-foreground">{t("superadmin.documents.partnerAllowlistHint")}</p>
                {partners.length === 0 ? (
                  <p className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">{t("superadmin.documents.partnersLoadEmpty")}</p>
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
                      className="input-native min-h-[120px] px-2 py-1"
                    >
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, allowedOrganizationIds: [] }))}
                        className="text-sm text-primary hover:underline"
                      >
                        {t("superadmin.documents.clearPartnerSelection")}
                      </button>
                      <span className="text-xs text-muted-foreground">
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
              <p className="rounded-sm border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {t("superadmin.documents.partnerOwnedDocHint")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || uploadingFile}
                className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? t("common.saving") : editingId ? t("superadmin.documents.buttonUpdate") : t("superadmin.documents.buttonCreate")}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {documents.length > 0 && !loading && !error && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("superadmin.documents.searchPlaceholder")}
              className="w-full rounded-sm border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="off"
            />
          </div>
          <div
            className="inline-flex shrink-0 rounded-sm border border-border/60 bg-muted/30 p-0.5 ring-1 ring-border/40"
            role="group"
            aria-label={t("superadmin.documents.layoutToggleGroup")}
          >
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={viewMode === "table"}
              title={t("superadmin.documents.viewTableAria")}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-4 w-4" />
              {t("superadmin.documents.viewTable")}
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-pressed={viewMode === "cards"}
              title={t("superadmin.documents.viewCardsAria")}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-background text-foreground ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              {t("superadmin.documents.viewCards")}
            </button>
          </div>
        </div>
      )}

      <div className="surface-card-overflow">
        {error && (
          <div className="p-4 bg-amber-50 text-amber-800 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.documents.loadingDocuments")}</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.documents.noDocumentsYet")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("superadmin.documents.addDocumentHint")}</p>
            <button
              type="button"
              onClick={openNew}
              className="mt-4 inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("superadmin.documents.emptyStateAddButton")}
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.documents.noSearchResults")}</div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.documents.fieldTitle")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.documents.colCategory")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.documents.colVisibility")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.documents.colCountry")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.documents.colPartners")}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.documents.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      {doc.fileUrl?.trim() ? (
                        <a
                          href={`/api/saas/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          {doc.title}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="font-medium text-muted-foreground">{doc.title}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{doc.category?.name ?? doc.categoryId}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{visibilityOptionLabel(t, doc.visibility)}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{doc.countryScope ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
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
                        className="text-muted-foreground hover:text-primary p-1"
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
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col rounded-sm border border-border/60 bg-muted/20 p-4 transition-colors hover:border-border"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {doc.fileUrl?.trim() ? (
                      <a
                        href={`/api/saas/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        <span className="line-clamp-2">{doc.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium text-muted-foreground line-clamp-2">{doc.title}</span>
                    )}
                    {doc.description?.trim() && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(doc)}
                    className="shrink-0 text-muted-foreground hover:text-primary p-1"
                    title={t("common.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <dl className="mt-auto space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t("superadmin.documents.colCategory")}</dt>
                    <dd className="text-right font-medium text-foreground">{doc.category?.name ?? doc.categoryId}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t("superadmin.documents.colVisibility")}</dt>
                    <dd className="text-right">{visibilityOptionLabel(t, doc.visibility)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t("superadmin.documents.colCountry")}</dt>
                    <dd className="text-right">{doc.countryScope ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t("superadmin.documents.colPartners")}</dt>
                    <dd className="text-right">
                      {doc.organizationId
                        ? t("superadmin.documents.oneOrganizationDoc")
                        : (doc.allowedOrganizationIds?.length ?? 0) === 0
                          ? t("superadmin.documents.allPartners")
                          : t("superadmin.documents.selectedPartnersCount", { count: doc.allowedOrganizationIds?.length ?? 0 })}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
        {!loading && documents.length > 0 && (
          <p className="px-5 py-2 text-xs text-muted-foreground border-t border-border/60">
            {hasSearch
              ? t("superadmin.documents.searchSummary", {
                  shown: filteredDocuments.length,
                  total: documents.length,
                })
              : t("superadmin.documents.totalCount", { count: total })}
          </p>
        )}
      </div>
    </div>
  );
}

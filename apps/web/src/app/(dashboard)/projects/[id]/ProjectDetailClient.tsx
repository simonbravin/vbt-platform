"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, Pencil, Trash2, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Country = { id: string; name: string; code: string };
type Quote = {
  id: string;
  quoteNumber: string;
  version?: number;
  status: string;
  totalPrice?: number;
  createdAt: string;
  project?: { projectName: string } | null;
};

type Project = {
  id: string;
  projectName: string;
  name?: string;
  client?: { id: string; name: string } | null;
  clientRecord?: { id: string; name: string } | null;
  clientId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  description: string | null;
  status?: string;
  estimatedTotalAreaM2?: number | null;
  estimatedWallAreaM2?: number | null;
  expectedCloseDate?: string | null;
  quotes: Quote[];
};

type AuditEntry = { id: string; action: string; createdAt: string; userName: string | null; meta: { changed?: string[] } | null };
type SaleRow = { id: string; saleNumber: string | null; status: string; landedDdpUsd: number };

const PIPELINE_STATUSES = ["lead", "qualified", "quoting", "engineering", "won", "lost", "on_hold"] as const;

const QUOTE_STATUS_I18N: Record<string, string> = {
  draft: "quotes.draft",
  sent: "quotes.sent",
  accepted: "quotes.accepted",
  rejected: "quotes.rejected",
  expired: "quotes.expired",
  archived: "quotes.archived",
};

export function ProjectDetailClient({ initialProject }: { initialProject: Project }) {
  const { t, locale } = useLanguage();
  const dateLocale = locale === "es" ? "es-419" : "en-US";

  const projectStatusLabel = (code: string) => t(`partner.reports.status.${code}`);
  const quoteStatusLabel = (status: string) => {
    const k = QUOTE_STATUS_I18N[status.toLowerCase()];
    return k ? t(k) : status;
  };
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", legalName: "", countryId: "", email: "", phone: "" });
  const [savingClient, setSavingClient] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const projectName = project.projectName ?? (project as any).name ?? "";
  const projectClientId = project.clientId ?? project.client?.id ?? (project as any).clientRecord?.id ?? "";
  const [form, setForm] = useState({
    projectName,
    clientId: projectClientId,
    countryCode: project.countryCode ?? "",
    city: project.city ?? "",
    address: project.address ?? "",
    description: project.description ?? "",
    status: (project as any).status ?? "lead",
    estimatedTotalAreaM2: project.estimatedTotalAreaM2 != null ? String(project.estimatedTotalAreaM2) : "",
    expectedCloseDate: project.expectedCloseDate ? String(project.expectedCloseDate).slice(0, 10) : "",
  });

  // Auditoría por proyecto: aún no hay `/api/saas/projects/:id/audit`.
  useEffect(() => {
    fetch(`/api/projects/${project.id}/audit`)
      .then((r) => r.json())
      .then((data) => { setAuditLog(Array.isArray(data) ? data : []); setLoadingAudit(false); })
      .catch(() => setLoadingAudit(false));
  }, [project.id]);

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((d) => setCountries(Array.isArray(d) ? d : d.countries ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/clients?limit=500")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    fetch(`/api/sales?projectId=${project.id}&limit=50`)
      .then((r) => r.json())
      .then((d) => setSales(d.sales ?? []))
      .catch(() => setSales([]));
  }, [project.id]);

  const openEdit = () => {
    setForm({
      projectName: project.projectName ?? (project as any).name ?? "",
      clientId: project.clientId ?? project.client?.id ?? (project as any).clientRecord?.id ?? "",
      countryCode: project.countryCode ?? "",
      city: project.city ?? "",
      address: project.address ?? "",
      description: project.description ?? "",
      status: (project as any).status ?? "lead",
      estimatedTotalAreaM2: project.estimatedTotalAreaM2 != null ? String(project.estimatedTotalAreaM2) : "",
      expectedCloseDate: project.expectedCloseDate ? String(project.expectedCloseDate).slice(0, 10) : "",
    });
    setEditOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/saas/projects/${project.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteDialog(false);
    if (res.ok) router.push("/projects");
  };

  const saveNewClient = async () => {
    if (!newClientForm.name.trim()) return;
    setSavingClient(true);
    setNewClientError(null);
    try {
      const countryCode = newClientForm.countryId
        ? (countries.find((c) => c.id === newClientForm.countryId)?.code ?? newClientForm.countryId)
        : undefined;
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientForm.name.trim(),
          legalName: newClientForm.legalName.trim() || undefined,
          countryCode: countryCode || undefined,
          email: newClientForm.email.trim() || undefined,
          phone: newClientForm.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClients((prev) => [...prev, data]);
        setForm((f) => ({ ...f, clientId: data.id }));
        setNewClientOpen(false);
        setNewClientForm({ name: "", legalName: "", countryId: "", email: "", phone: "" });
      } else {
        setNewClientError(data.error ?? t("auth.errorUnexpected"));
      }
    } catch {
      setNewClientError(t("auth.errorUnexpected"));
    } finally {
      setSavingClient(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await fetch(`/api/saas/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: form.projectName?.trim() || undefined,
        clientId: form.clientId || null,
        countryCode: form.countryCode?.trim() || null,
        city: form.city?.trim() || undefined,
        address: form.address?.trim() || undefined,
        description: form.description?.trim() || undefined,
        status: form.status,
        estimatedTotalAreaM2: form.estimatedTotalAreaM2 !== "" ? Number(form.estimatedTotalAreaM2) || null : null,
        expectedCloseDate: form.expectedCloseDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
      setEditOpen(false);
      const auditRes = await fetch(`/api/projects/${project.id}/audit`);
      const auditData = await auditRes.json();
      setAuditLog(Array.isArray(auditData) ? auditData : []);
    }
  };

  const formatAction = (action: string, meta: { changed?: string[] } | null) => {
    if (action === "PROJECT_CREATED") return t("projects.logCreated");
    if (action === "PROJECT_UPDATED" && meta?.changed?.length) return `${t("projects.logUpdated")}: ${meta.changed.join(", ")}`;
    return action.replace(/_/g, " ").toLowerCase();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{projectName}</h1>
            {(project.client?.name ?? (project as any).clientRecord?.name ?? (project as any).client) && (
              <p className="text-gray-500 text-sm">{project.client?.name ?? (project as any).clientRecord?.name ?? (project as any).client}</p>
            )}
            {(project.city ?? project.countryCode ?? project.address) && (
              <p className="text-gray-500 text-sm">{[project.city, project.countryCode, project.address].filter(Boolean).join(" · ")}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {(project as any).status && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  (project as any).status === "won" || (project as any).status === "SOLD" ? "bg-green-100 text-green-700" :
                  (project as any).status === "lost" || (project as any).status === "ARCHIVED" ? "bg-gray-200 text-gray-600" :
                  (project as any).status === "quoting" || (project as any).status === "QUOTE_SENT" ? "bg-blue-100 text-blue-700" :
                  (project as any).status === "qualified" || (project as any).status === "QUOTED" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{projectStatusLabel((project as any).status)}</span>
              )}
              {project.expectedCloseDate && (
                <p className="text-gray-400 text-xs mt-0.5">{t("projects.expectedClose")} {new Date(project.expectedCloseDate).toLocaleDateString(dateLocale)}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" /> {t("common.edit")}
          </button>
          <button
            type="button"
            onClick={() => setDeleteDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> {t("common.delete")}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title={t("projects.deleteProjectTitle")}
        description={t("projects.deleteProjectMsg", { name: projectName })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("projects.deleting")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* Project info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{t("projects.projectDetails")}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {(project.client?.name ?? (project as any).clientRecord?.name) && (
            <>
              <dt className="text-gray-500">{t("projects.client")}</dt>
              <dd className="text-gray-900 font-medium">
                {(project.client?.id ?? (project as any).clientRecord?.id) ? (
                  <Link href={`/clients/${project.client?.id ?? (project as any).clientRecord?.id}`} className="text-vbt-blue hover:underline">
                    {project.client?.name ?? (project as any).clientRecord?.name}
                  </Link>
                ) : (
                  project.client?.name ?? (project as any).clientRecord?.name
                )}
              </dd>
            </>
          )}
          {(project.city ?? project.countryCode) && (
            <>
              <dt className="text-gray-500">{t("projects.location")}</dt>
              <dd className="text-gray-900">{[project.city, project.countryCode].filter(Boolean).join(", ")}</dd>
            </>
          )}
          {project.address && (
            <>
              <dt className="text-gray-500">{t("projects.address")}</dt>
              <dd className="text-gray-900">{project.address}</dd>
            </>
          )}
          {(project.estimatedTotalAreaM2 != null || project.estimatedWallAreaM2 != null) && (
            <>
              <dt className="text-gray-500">{t("projects.estArea")}</dt>
              <dd className="text-gray-900">
                {project.estimatedTotalAreaM2 != null && t("projects.estAreaTotal", { value: Number(project.estimatedTotalAreaM2).toFixed(1) })}
                {project.estimatedTotalAreaM2 != null && project.estimatedWallAreaM2 != null && " · "}
                {project.estimatedWallAreaM2 != null && t("projects.estAreaWall", { value: Number(project.estimatedWallAreaM2).toFixed(1) })}
              </dd>
            </>
          )}
          {project.expectedCloseDate && (
            <>
              <dt className="text-gray-500">{t("projects.expectedClose").replace(/:?\s*$/, "")}</dt>
              <dd className="text-gray-900">{new Date(project.expectedCloseDate).toLocaleDateString(dateLocale)}</dd>
            </>
          )}
          {project.description && (
            <>
              <dt className="text-gray-500 sm:col-span-1">{t("projects.description")}</dt>
              <dd className="text-gray-900 sm:col-span-2">{project.description}</dd>
            </>
          )}
          {(project as any).status && (
            <>
              <dt className="text-gray-500">{t("common.status")}</dt>
              <dd className="text-gray-900 font-medium">{projectStatusLabel((project as any).status)}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Quotes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("projects.quotesWithCount", { count: project.quotes.length })}</h2>
          <Link
            href={`/quotes/create?projectId=${project.id}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            <Plus className="w-3.5 h-3.5" /> {t("quotes.newQuote")}
          </Link>
        </div>
        {project.quotes.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{t("projects.noQuotesForProject")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {project.quotes.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 gap-3">
                <div>
                  <p className="font-medium text-gray-800">{q.quoteNumber ?? q.id.slice(0, 8)}</p>
                  <p className="text-gray-400 text-xs">
                    v{q.version ?? 1} · {new Date(q.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{q.totalPrice != null ? formatCurrency(q.totalPrice) : "—"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    q.status === "sent" || q.status === "SENT" ? "bg-green-100 text-green-700" :
                    q.status === "draft" || q.status === "DRAFT" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>{quoteStatusLabel(q.status)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Sales */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("projects.salesWithCount", { count: sales.length })}</h2>
          <Link
            href={`/sales/new?projectId=${project.id}&clientId=${(project as any).clientId ?? (project as any).clientRecord?.id ?? ""}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-vbt-orange text-vbt-orange rounded-lg text-sm font-medium hover:bg-orange-50"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> {t("projects.newSale")}
          </Link>
        </div>
        {sales.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{t("projects.noSalesForProject")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sales.map((s) => (
              <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 gap-3">
                <div>
                  <p className="font-medium text-gray-800">{s.saleNumber ?? s.id.slice(0, 8)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.status === "PAID" ? "bg-green-100 text-green-700" :
                    s.status === "CANCELLED" ? "bg-gray-200 text-gray-600" :
                    s.status === "PARTIALLY_PAID" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  }`}>{t(`partner.sales.status.${s.status}`)}</span>
                </div>
                <p className="font-semibold text-gray-800">{formatCurrency(s.landedDdpUsd)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Activity / Change log */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t("projects.activity")}</h2>
          <p className="text-gray-500 text-xs mt-0.5">{t("projects.changesAndWho")}</p>
        </div>
        <div className="p-5">
          {loadingAudit ? (
            <p className="text-gray-400 text-sm">{t("common.loading")}</p>
          ) : auditLog.length === 0 ? (
            <p className="text-gray-400 text-sm">{t("projects.noActivityYet")}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-2 text-gray-700">
                  <span className="font-medium">{entry.userName ?? t("projects.system")}</span>
                  <span className="text-gray-500">{formatAction(entry.action, entry.meta)}</span>
                  <span className="text-gray-400 text-xs">{new Date(entry.createdAt).toLocaleString(dateLocale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit modal (portal so overlay covers full viewport including sidebar/header) */}
      {editOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">{t("projects.editProject")}</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.projectNameLabel")}</label>
                <input value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("common.status")}</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  {PIPELINE_STATUSES.map((v) => (
                    <option key={v} value={v}>{t(`partner.reports.status.${v}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.client")}</label>
                <div className="flex gap-2">
                  <select
                    value={form.clientId}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">{t("projects.noneOption")}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setNewClientOpen(true)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> {t("projects.addClientButton")}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.countryCodeLabel")}</label>
                <select value={form.countryCode} onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">{t("projects.selectShort")}</option>
                  {countries.map((c) => <option key={c.id} value={c.code ?? c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.city")}</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder={t("projects.city")} />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.address")}</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder={t("projects.addressPlaceholder")} />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.estTotalAreaM2Label")}</label>
                <input type="number" min={0} step="0.01" value={form.estimatedTotalAreaM2} onChange={(e) => setForm((f) => ({ ...f, estimatedTotalAreaM2: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder={t("projects.areaPlaceholder")} />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.expectedCloseDateLabel")}</label>
                <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">{t("projects.description")}</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{t("common.cancel")}</button>
              <button type="button" onClick={saveEdit} disabled={saving || !form.projectName?.trim()} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900 disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {newClientOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4" onClick={() => setNewClientOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg text-gray-900">{t("projects.newClientModalTitle")}</h3>
            {newClientError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{newClientError}</div>
            )}
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t("clients.nameLabel")}</label>
              <input
                value={newClientForm.name}
                onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
                placeholder={t("projects.companyNamePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t("projects.legalName")}</label>
              <input
                value={newClientForm.legalName}
                onChange={(e) => setNewClientForm((f) => ({ ...f, legalName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t("common.country")}</label>
              <select
                value={newClientForm.countryId}
                onChange={(e) => setNewClientForm((f) => ({ ...f, countryId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue bg-white"
              >
                <option value="">{t("projects.noneOption")}</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t("auth.email")}</label>
              <input
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t("common.phone")}</label>
              <input
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
            <div className="flex gap-2 pt-2 justify-end">
              <button type="button" onClick={() => setNewClientOpen(false)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t("common.cancel")}</button>
              <button type="button" onClick={saveNewClient} disabled={savingClient || !newClientForm.name.trim()} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50">{savingClient ? t("common.saving") : t("projects.createClient")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, Pencil, Trash2, ShoppingCart, Archive } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterSelect } from "@/components/ui/filter-select";
import { saasApiUserFacingMessage } from "@/lib/saas-api-error-message";

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
  baselineQuoteId?: string | null;
  baselineQuote?: { id: string; quoteNumber: string } | null;
  quotes: Quote[];
  _count?: { sales: number; saleProjectLines: number };
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

export function ProjectDetailClient({
  initialProject,
  canOrgAdmin = false,
}: {
  initialProject: Project;
  canOrgAdmin?: boolean;
}) {
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [purgeDialog, setPurgeDialog] = useState(false);
  const [purgeAck, setPurgeAck] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", legalName: "", countryId: "", email: "", phone: "" });
  const [savingClient, setSavingClient] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [baselineQuoteId, setBaselineQuoteId] = useState(
    () => project.baselineQuoteId ?? project.baselineQuote?.id ?? ""
  );
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
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

  useEffect(() => {
    fetch(`/api/saas/projects/${project.id}/audit`)
      .then((r) => r.json())
      .then((data) => {
        const entries = Array.isArray(data) ? data : (data?.entries ?? []);
        setAuditLog(Array.isArray(entries) ? entries : []);
        setLoadingAudit(false);
      })
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

  useEffect(() => {
    setBaselineQuoteId(project.baselineQuoteId ?? project.baselineQuote?.id ?? "");
    setBaselineError(null);
  }, [project.id, project.baselineQuoteId, project.baselineQuote?.id]);

  const saveBaseline = async () => {
    setBaselineSaving(true);
    setBaselineError(null);
    try {
      const res = await fetch(`/api/saas/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselineQuoteId: baselineQuoteId.trim() ? baselineQuoteId.trim() : null }),
      });
      let errBody: { error?: string } = {};
      try {
        errBody = await res.json();
      } catch {
        errBody = {};
      }
      if (!res.ok) {
        setBaselineError(saasApiUserFacingMessage(errBody, t, t("auth.errorUnexpected")));
        return;
      }
      const fullRes = await fetch(`/api/saas/projects/${project.id}`);
      const full = await fullRes.json();
      if (fullRes.ok && full && typeof full === "object" && "id" in full) {
        setProject(full as Project);
      }
    } catch {
      setBaselineError(t("auth.errorUnexpected"));
    } finally {
      setBaselineSaving(false);
    }
  };

  const openEdit = () => {
    setEditError(null);
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
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/saas/projects/${project.id}`, { method: "DELETE" });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok) {
        setDeleteError(saasApiUserFacingMessage(body, t, t("auth.errorUnexpected")));
        return;
      }
      setDeleteDialog(false);
      router.push("/projects");
    } catch {
      setDeleteError(t("auth.errorUnexpected"));
    } finally {
      setDeleting(false);
    }
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
        setNewClientError(saasApiUserFacingMessage(data, t, t("auth.errorUnexpected")));
      }
    } catch {
      setNewClientError(t("auth.errorUnexpected"));
    } finally {
      setSavingClient(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    setEditError(null);
    try {
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
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok) {
        setEditError(saasApiUserFacingMessage(body, t, t("projects.failedSave")));
        return;
      }
      if (body && typeof body === "object" && "id" in body) {
        setProject(body as Project);
      }
      setEditOpen(false);
      const auditRes = await fetch(`/api/saas/projects/${project.id}/audit`);
      const auditData = await auditRes.json();
      const entries = Array.isArray(auditData) ? auditData : (auditData?.entries ?? []);
      setAuditLog(Array.isArray(entries) ? entries : []);
    } catch {
      setEditError(t("projects.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const formatAction = (action: string, meta: { changed?: string[] } | null) => {
    if (action === "PROJECT_CREATED") return t("projects.logCreated");
    if (action === "PROJECT_UPDATED" && meta?.changed?.length) return `${t("projects.logUpdated")}: ${meta.changed.join(", ")}`;
    if (action === "PROJECT_ARCHIVED") return t("projects.logArchived");
    if (action === "PROJECT_DELETED") return t("projects.logDeleted");
    if (action === "PROJECT_PURGED") return t("projects.logPurged");
    return action.replace(/_/g, " ").toLowerCase();
  };

  const purgeBlocked =
    ((project._count?.sales ?? 0) > 0 || (project._count?.saleProjectLines ?? 0) > 0) || sales.length > 0;

  const handlePurge = async () => {
    setPurgeError(null);
    setPurging(true);
    try {
      const res = await fetch(`/api/saas/projects/${project.id}/purge`, { method: "POST" });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok) {
        setPurgeError(saasApiUserFacingMessage(body, t, t("auth.errorUnexpected")));
        return;
      }
      setPurgeDialog(false);
      setPurgeAck(false);
      router.push("/projects");
    } catch {
      setPurgeError(t("auth.errorUnexpected"));
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-muted-foreground/70 hover:text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{projectName}</h1>
            {(project.client?.name ?? (project as any).clientRecord?.name ?? (project as any).client) && (
              <p className="text-muted-foreground text-sm">{project.client?.name ?? (project as any).clientRecord?.name ?? (project as any).client}</p>
            )}
            {(project.city ?? project.countryCode ?? project.address) && (
              <p className="text-muted-foreground text-sm">{[project.city, project.countryCode, project.address].filter(Boolean).join(" · ")}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {(project as any).status && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  (project as any).status === "won" || (project as any).status === "SOLD" ? "border border-primary/25 bg-primary/10 text-primary" :
                  (project as any).status === "lost" || (project as any).status === "ARCHIVED" ? "bg-muted text-muted-foreground" :
                  (project as any).status === "quoting" || (project as any).status === "QUOTE_SENT" ? "bg-primary/10 text-primary" :
                  (project as any).status === "qualified" || (project as any).status === "QUOTED" ? "border border-border/80 bg-muted text-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>{projectStatusLabel((project as any).status)}</span>
              )}
              {project.expectedCloseDate && (
                <p className="text-muted-foreground/70 text-xs mt-0.5">{t("projects.expectedClose")} {new Date(project.expectedCloseDate).toLocaleDateString(dateLocale)}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 border border-input rounded-lg text-sm text-foreground hover:bg-muted/40"
          >
            <Pencil className="w-4 h-4" /> {t("common.edit")}
          </button>
          {canOrgAdmin && (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleteDialog(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/40"
            >
              <Archive className="w-4 h-4" /> {t("common.archive")}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={(open) => {
          if (!open) setDeleteError(null);
          setDeleteDialog(open);
        }}
        title={t("projects.archiveProjectTitle")}
        description={t("projects.archiveProjectMsg", { name: projectName })}
        confirmLabel={t("common.archive")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("projects.archiving")}
        variant="primary"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
      />

      {/* Project info */}
      <div className="surface-card p-5">
        <h2 className="font-semibold text-foreground mb-4">{t("projects.projectDetails")}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {(project.client?.name ?? (project as any).clientRecord?.name) && (
            <>
              <dt className="text-muted-foreground">{t("projects.client")}</dt>
              <dd className="text-foreground font-medium">
                {(project.client?.id ?? (project as any).clientRecord?.id) ? (
                  <Link href={`/clients/${project.client?.id ?? (project as any).clientRecord?.id}`} className="text-primary hover:underline">
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
              <dt className="text-muted-foreground">{t("projects.location")}</dt>
              <dd className="text-foreground">{[project.city, project.countryCode].filter(Boolean).join(", ")}</dd>
            </>
          )}
          {project.address && (
            <>
              <dt className="text-muted-foreground">{t("projects.address")}</dt>
              <dd className="text-foreground">{project.address}</dd>
            </>
          )}
          {(project.estimatedTotalAreaM2 != null || project.estimatedWallAreaM2 != null) && (
            <>
              <dt className="text-muted-foreground">{t("projects.estArea")}</dt>
              <dd className="text-foreground">
                {project.estimatedTotalAreaM2 != null && t("projects.estAreaTotal", { value: Number(project.estimatedTotalAreaM2).toFixed(1) })}
                {project.estimatedTotalAreaM2 != null && project.estimatedWallAreaM2 != null && " · "}
                {project.estimatedWallAreaM2 != null && t("projects.estAreaWall", { value: Number(project.estimatedWallAreaM2).toFixed(1) })}
              </dd>
            </>
          )}
          {project.expectedCloseDate && (
            <>
              <dt className="text-muted-foreground">{t("projects.expectedClose").replace(/:?\s*$/, "")}</dt>
              <dd className="text-foreground">{new Date(project.expectedCloseDate).toLocaleDateString(dateLocale)}</dd>
            </>
          )}
          {project.description && (
            <>
              <dt className="text-muted-foreground sm:col-span-1">{t("projects.description")}</dt>
              <dd className="text-foreground sm:col-span-2">{project.description}</dd>
            </>
          )}
          {(project as any).status && (
            <>
              <dt className="text-muted-foreground">{t("common.status")}</dt>
              <dd className="text-foreground font-medium">{projectStatusLabel((project as any).status)}</dd>
            </>
          )}
        </dl>
        <div className="border-t border-border/60 pt-4 mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("projects.baselineQuoteSection")}</h3>
          <p className="text-xs text-muted-foreground">{t("projects.baselineQuoteHelp")}</p>
          {baselineError && (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-sm text-destructive">{baselineError}</div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <FilterSelect
                value={baselineQuoteId}
                onValueChange={setBaselineQuoteId}
                emptyOptionLabel={t("projects.baselineQuoteNone")}
                options={project.quotes.map((q) => ({
                  value: q.id,
                  label: `${q.quoteNumber ?? q.id.slice(0, 8)}${q.version != null ? ` · v${q.version}` : ""}`,
                }))}
                aria-label={t("projects.baselineQuoteSection")}
                triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveBaseline}
              disabled={baselineSaving}
              className="shrink-0 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {baselineSaving ? t("projects.baselineQuoteSaving") : t("projects.baselineQuoteSave")}
            </button>
          </div>
        </div>
      </div>

      {/* Quotes */}
      <div className="surface-card">
        <div className="p-5 border-b border-border/60 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t("projects.quotesWithCount", { count: project.quotes.length })}</h2>
          <Link
            href={`/quotes/wizard?projectId=${project.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-transparent bg-primary px-4 py-2 text-[17px] font-normal text-primary-foreground hover:opacity-[0.88]"
          >
            <Plus className="w-3.5 h-3.5" /> {t("quotes.newQuote")}
          </Link>
        </div>
        {project.quotes.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground/70 text-sm">{t("projects.noQuotesForProject")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {project.quotes.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between p-4 hover:bg-muted/40 gap-3">
                <div>
                  <p className="font-medium text-foreground">{q.quoteNumber ?? q.id.slice(0, 8)}</p>
                  <p className="text-muted-foreground/70 text-xs">
                    v{q.version ?? 1} · {new Date(q.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{q.totalPrice != null ? formatCurrency(q.totalPrice) : "—"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    q.status === "sent" || q.status === "SENT" ? "border border-primary/25 bg-primary/10 text-primary" :
                    q.status === "draft" || q.status === "DRAFT" ? "border border-border/80 bg-muted text-foreground" : "bg-muted text-muted-foreground"
                  }`}>{quoteStatusLabel(q.status)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Sales */}
      <div className="surface-card">
        <div className="p-5 border-b border-border/60 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t("projects.salesWithCount", { count: sales.length })}</h2>
          <Link
            href={`/sales/new?projectId=${project.id}&clientId=${(project as any).clientId ?? (project as any).clientRecord?.id ?? ""}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> {t("projects.newSale")}
          </Link>
        </div>
        {sales.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground/70 text-sm">{t("projects.noSalesForProject")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {sales.map((s) => (
              <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center justify-between p-4 hover:bg-muted/40 gap-3">
                <div>
                  <p className="font-medium text-foreground">{s.saleNumber ?? s.id.slice(0, 8)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.status === "PAID" ? "border border-primary/25 bg-primary/10 text-primary" :
                    s.status === "CANCELLED" ? "bg-muted text-muted-foreground" :
                    s.status === "PARTIALLY_PAID" ? "border border-border/80 bg-muted text-foreground" : "bg-primary/10 text-primary"
                  }`}>{t(`partner.sales.status.${s.status}`)}</span>
                </div>
                <p className="font-semibold text-foreground">{formatCurrency(s.landedDdpUsd)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Activity / Change log */}
      <div className="surface-card">
        <div className="p-5 border-b border-border/60">
          <h2 className="font-semibold text-foreground">{t("projects.activity")}</h2>
          <p className="text-muted-foreground text-xs mt-0.5">{t("projects.changesAndWho")}</p>
        </div>
        <div className="p-5">
          {loadingAudit ? (
            <p className="text-muted-foreground/70 text-sm">{t("common.loading")}</p>
          ) : auditLog.length === 0 ? (
            <p className="text-muted-foreground/70 text-sm">{t("projects.noActivityYet")}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-2 text-foreground">
                  <span className="font-medium">{entry.userName ?? t("projects.system")}</span>
                  <span className="text-muted-foreground">{formatAction(entry.action, entry.meta)}</span>
                  <span className="text-muted-foreground/70 text-xs">{new Date(entry.createdAt).toLocaleString(dateLocale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {canOrgAdmin && (
        <div className="surface-card border border-destructive/20 p-5">
          <h2 className="font-semibold text-foreground mb-1">{t("projects.dangerZoneTitle")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("projects.dangerZoneIntro")}</p>
          {purgeBlocked ? (
            <p className="text-sm text-muted-foreground">{t("projects.purgeBlockedBody")}</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPurgeError(null);
                setPurgeAck(false);
                setPurgeDialog(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" /> {t("projects.purgeConfirmButton")}
            </button>
          )}
        </div>
      )}

      {purgeDialog && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !purging) {
              setPurgeDialog(false);
              setPurgeAck(false);
              setPurgeError(null);
            }
          }}
        >
          <div className="bg-card text-card-foreground rounded-lg max-w-md w-full p-6 border border-border/80 shadow-none" onClick={(e) => e.stopPropagation()}>
            <h3 id="purge-dialog-title" className="font-semibold text-lg mb-2 text-foreground tracking-[-0.02em]">
              {t("projects.purgeTitle")}
            </h3>
            <p className="text-muted-foreground text-caption mb-4">
              {t("projects.purgeDescription", { name: projectName })}
            </p>
            <label className="flex items-start gap-2 text-sm text-foreground mb-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                checked={purgeAck}
                onChange={(e) => setPurgeAck(e.target.checked)}
                disabled={purging}
              />
              <span>{t("projects.purgeConfirmCheckbox")}</span>
            </label>
            {purgeError && (
              <p className="text-caption text-destructive mb-4 border border-destructive/30 rounded-lg px-3 py-2 bg-destructive/5" role="alert">
                {purgeError}
              </p>
            )}
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (!purging) {
                    setPurgeDialog(false);
                    setPurgeAck(false);
                    setPurgeError(null);
                  }
                }}
                disabled={purging}
                className="px-5 py-2.5 border border-border/80 rounded-full text-[17px] text-foreground hover:bg-muted disabled:opacity-50 font-normal"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handlePurge}
                disabled={purging || !purgeAck}
                className="px-5 py-2.5 bg-destructive text-destructive-foreground rounded-full text-[17px] font-normal hover:opacity-90 disabled:opacity-50 border border-transparent"
              >
                {purging ? t("projects.purging") : t("projects.purgeConfirmButton")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit modal (portal so overlay covers full viewport including sidebar/header) */}
      {editOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border/60 bg-background p-6">
            <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{t("projects.editProject")}</h3>
            {editError && (
              <div className="mb-3 rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-sm text-destructive">{editError}</div>
            )}
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.projectNameLabel")}</label>
                <input value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("common.status")}</label>
                <FilterSelect
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  options={PIPELINE_STATUSES.map((v) => ({
                    value: v,
                    label: t(`partner.reports.status.${v}`),
                  }))}
                  aria-label={t("common.status")}
                  triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.client")}</label>
                <div className="flex gap-2">
                  <FilterSelect
                    value={form.clientId}
                    onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
                    emptyOptionLabel={t("projects.noneOption")}
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    aria-label={t("projects.client")}
                    triggerClassName="h-10 min-w-0 flex-1 max-w-full text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setNewClientOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <Plus className="w-4 h-4" /> {t("projects.addClientButton")}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.countryCodeLabel")}</label>
                <FilterSelect
                  value={form.countryCode}
                  onValueChange={(v) => setForm((f) => ({ ...f, countryCode: v }))}
                  emptyOptionLabel={t("projects.selectShort")}
                  options={countries.map((c) => ({
                    value: c.code ?? c.id,
                    label: `${c.name} (${c.code})`,
                  }))}
                  aria-label={t("projects.countryCodeLabel")}
                  triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.city")}</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder={t("projects.city")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.address")}</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder={t("projects.addressPlaceholder")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.estTotalAreaM2Label")}</label>
                <input type="number" min={0} step="0.01" value={form.estimatedTotalAreaM2} onChange={(e) => setForm((f) => ({ ...f, estimatedTotalAreaM2: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder={t("projects.areaPlaceholder")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.expectedCloseDateLabel")}</label>
                <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("projects.description")}</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditError(null);
                  setEditOpen(false);
                }}
                className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
              <button type="button" onClick={saveEdit} disabled={saving || !form.projectName?.trim()} className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {newClientOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-4" onClick={() => setNewClientOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-lg border border-border/60 bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("projects.newClientModalTitle")}</h3>
            {newClientError && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-sm text-destructive">{newClientError}</div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("clients.nameLabel")}</label>
              <input
                value={newClientForm.name}
                onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={t("projects.companyNamePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("projects.legalName")}</label>
              <input
                value={newClientForm.legalName}
                onChange={(e) => setNewClientForm((f) => ({ ...f, legalName: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("common.country")}</label>
              <FilterSelect
                value={newClientForm.countryId}
                onValueChange={(v) => setNewClientForm((f) => ({ ...f, countryId: v }))}
                emptyOptionLabel={t("projects.noneOption")}
                options={countries.map((c) => ({ value: c.id, label: c.name }))}
                aria-label={t("common.country")}
                triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("auth.email")}</label>
              <input
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("common.phone")}</label>
              <input
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewClientOpen(false)} className="rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-muted">{t("common.cancel")}</button>
              <button type="button" onClick={saveNewClient} disabled={savingClient || !newClientForm.name.trim()} className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{savingClient ? t("common.saving") : t("projects.createClient")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

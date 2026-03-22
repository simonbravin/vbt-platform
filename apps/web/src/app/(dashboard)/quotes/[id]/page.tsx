"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Mail, Archive, Trash2, ChevronDown, ChevronRight, Pencil, Activity, ShoppingCart, Copy } from "lucide-react";
import { useLanguage, useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { normalizeQuoteStatus } from "@vbt/core";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** i18n key for Prisma `QuoteStatus` (and legacy UI labels mapped server-side). */
function statusTranslationKey(status: string | undefined): string {
  const n = normalizeQuoteStatus(status ?? "draft") ?? "draft";
  const map: Record<string, string> = {
    draft: "quotes.draft",
    sent: "quotes.sent",
    accepted: "quotes.accepted",
    rejected: "quotes.rejected",
    expired: "quotes.expired",
    archived: "quotes.archived",
  };
  return map[n] ?? "quotes.draft";
}

function paramId(params: { id?: string | string[] }): string | undefined {
  const raw = params.id;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) return raw[0];
  return undefined;
}

export default function QuoteDetailPage() {
  const t = useT();
  const { locale } = useLanguage();
  const params = useParams();
  const quoteId = paramId(params as { id?: string | string[] });
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [materialLinesOpen, setMaterialLinesOpen] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [pdfDialog, setPdfDialog] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({ includeAlerts: false, includeMaterialLines: true, showUnitPrice: true });
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<{ id: string; action: string; createdAt: string; userName: string | null; meta: { changed?: string[] } | null }[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Auditoría, email y PDF: aún no hay `/api/saas/quotes/:id/audit|email|pdf`.
  const fetchAudit = () => {
    fetch(`/api/quotes/${quoteId}/audit`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : null;
          setAuditLog(Array.isArray(data) ? data : []);
        } catch {
          setAuditLog([]);
        } finally {
          setLoadingAudit(false);
        }
      })
      .catch(() => setLoadingAudit(false));
  };

  useEffect(() => {
    if (!quoteId) {
      setLoading(false);
      setQuote(null);
      return;
    }
    fetch(`/api/saas/quotes/${quoteId}`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : null;
          setQuote(d);
          setEditNotes(d?.notes ?? "");
          setEditStatus(normalizeQuoteStatus(d?.status) ?? "draft");
        } catch {
          setQuote(null);
        } finally {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [quoteId]);

  useEffect(() => {
    if (!quote?.id) return;
    setLoadingAudit(true);
    fetch(`/api/quotes/${quote.id}/audit`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const data = text ? JSON.parse(text) : null;
          setAuditLog(Array.isArray(data) ? data : []);
        } catch {
          setAuditLog([]);
        } finally {
          setLoadingAudit(false);
        }
      })
      .catch(() => setLoadingAudit(false));
  }, [quote?.id]);

  // Email: legacy `/api/quotes/:id/email` hasta que exista SaaS.
  const sendEmail = async () => {
    if (!quoteId || !emailTo) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch(`/api/quotes/${quoteId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo, message: emailMsg, locale }),
    });
    let data: { error?: string } = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text);
    } catch {
      // ignore
    }
    setSending(false);
    if (res.ok) {
      setSendResult("__success__");
      setEmailDialog(false);
      setQuote((prev: any) => ({ ...prev, status: "sent" }));
      fetchAudit();
    } else {
      setSendResult(data.error ?? t("auth.errorGeneric"));
    }
  };

  const archive = async () => {
    setArchiving(true);
    const res = await fetch(`/api/saas/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setArchiving(false);
    setArchiveDialog(false);
    if (res.ok) {
      try {
        const text = await res.text();
        const updated = text ? JSON.parse(text) : null;
        if (updated) setQuote(updated);
        else setQuote((prev: any) => ({ ...prev, status: "archived" }));
      } catch {
        setQuote((prev: any) => ({ ...prev, status: "archived" }));
      }
      fetchAudit();
    }
  };

  const deletePermanently = async () => {
    setDeleting(true);
    const res = await fetch(`/api/saas/quotes/${quoteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteDialog(false);
    if (res.ok) router.push("/quotes");
  };

  const openEdit = () => {
    setEditNotes(quote?.notes ?? "");
    setEditStatus(normalizeQuoteStatus(quote?.status) ?? "draft");
    setEditOpen(true);
  };

  const duplicateQuote = async () => {
    if (!quoteId || duplicating) return;
    setDuplicateError(null);
    setDuplicating(true);
    try {
      const res = await fetch(`/api/saas/quotes/${quoteId}/duplicate`, { method: "POST" });
      const text = await res.text();
      let data: { id?: string; error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok || !data.id) {
        setDuplicateError(data.error ?? t("quotes.duplicateFailed"));
        return;
      }
      router.push(`/quotes/${data.id}`);
    } catch {
      setDuplicateError(t("quotes.duplicateFailed"));
    } finally {
      setDuplicating(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await fetch(`/api/saas/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editNotes || undefined, status: editStatus }),
    });
    setSaving(false);
    if (res.ok) {
      try {
        const text = await res.text();
        const updated = text ? JSON.parse(text) : null;
        if (updated) setQuote(updated);
      } catch {
        // ignore
      }
      setEditOpen(false);
      fetchAudit();
    }
  };

  const formatQuoteAction = (action: string, meta: { changed?: string[] } | null) => {
    if (action === "QUOTE_CREATED") return t("quotes.quoteCreated");
    if (action === "QUOTE_ARCHIVED") return t("quotes.archivedAction");
    if (action === "QUOTE_UPDATED" && meta?.changed?.length) return t("quotes.updatedAction", { fields: meta.changed.join(", ") });
    if (action === "QUOTE_DELETED") return t("quotes.deletedAction");
    if (action === "QUOTE_SENT") return t("quotes.emailSentAction");
    return action.replace(/_/g, " ").toLowerCase();
  };

  if (loading)
    return (
      <div className="p-12 text-center text-muted-foreground font-mono text-sm tracking-widest uppercase animate-pulse border border-dashed border-border rounded-sm">
        {t("common.loading")}
      </div>
    );
  if (!quote || quote.error)
    return (
      <div className="p-12 text-center text-destructive font-medium border border-destructive/30 bg-destructive/5 rounded-sm">
        {t("quotes.quoteNotFound")}
      </div>
    );

  const p = quote.pricing as
    | {
        factoryExwUsd?: number | null;
        basePriceForPartnerUsd?: number;
        afterPartnerMarkupUsd?: number;
        freightUsd?: number;
        cifUsd?: number;
        ruleTaxesUsd?: number;
        technicalServiceUsd?: number;
        suggestedLandedUsd?: number;
        landedTotalUsd?: number;
        taxLines?: Array<{ order: number; label: string; computedAmount: number; perContainer?: boolean }>;
      }
    | undefined;
  const hasPricing = p != null && typeof p === "object";
  const mainTotalUsd = Number(quote.totalPrice) || 0;
  const taxLinesFromPricing = hasPricing && Array.isArray(p!.taxLines) ? p!.taxLines : [];

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-10">
      {/* Header */}
      <div className="animate-engine-reveal flex flex-col gap-7 border-b border-border/60 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <Link
            href="/quotes"
            className="mt-1 shrink-0 p-2 text-muted-foreground hover:text-foreground border border-border/60 hover:border-primary/35 rounded-sm transition-colors"
            aria-label={t("quotes.title")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {quote.quoteNumber ?? quote.id.slice(0, 8).toUpperCase()}
              </h1>
              <span
                className={`px-2 py-0.5 text-[11px] rounded-sm font-mono font-semibold uppercase tracking-wider border ${
                  (() => {
                    const s = String(quote.status ?? "").toLowerCase();
                    if (s === "sent" || s === "accepted")
                      return "border-emerald-600/45 bg-emerald-500/10 text-emerald-950 dark:text-emerald-300";
                    if (s === "draft")
                      return "border border-alert-warningBorder bg-alert-warning text-foreground";
                    return "border-border bg-muted text-muted-foreground";
                  })()
                }`}
              >
                {t(statusTranslationKey(quote.status))}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-2 font-medium leading-relaxed">
              {(quote.project as { projectName?: string; name?: string } | undefined)?.projectName ??
                quote.project?.name}
              {quote.project?.client &&
                ` · ${(quote.project.client as { name?: string }).name ?? ""}`}
              {quote.country && ` → ${quote.country.name}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={() => void duplicateQuote()}
            disabled={duplicating}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border/60 rounded-sm text-sm text-foreground hover:bg-muted disabled:opacity-50 font-medium tracking-wide"
          >
            <Copy className="w-4 h-4 shrink-0" /> {duplicating ? t("quotes.duplicating") : t("quotes.duplicate")}
          </button>
          {quote.projectId && (
            <Link
              href={`/sales/new?quoteId=${quote.id}&projectId=${quote.projectId}&clientId=${(quote.project as any)?.clientId ?? ""}`}
              className="inline-flex items-center gap-2 rounded-sm border border-vbt-orange/30 bg-vbt-orange px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <ShoppingCart className="w-4 h-4 shrink-0" /> {t("quotes.createSale")}
            </Link>
          )}
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border/60 rounded-sm text-sm text-foreground hover:bg-muted font-medium"
          >
            <Pencil className="w-4 h-4 shrink-0" /> {t("common.edit")}
          </button>
          <button
            onClick={() => setPdfDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border/60 rounded-sm text-sm text-foreground hover:bg-muted font-medium"
          >
            <Download className="w-4 h-4 shrink-0" /> {t("quotes.pdf")}
          </button>
          <button
            onClick={() => setEmailDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-semibold hover:opacity-90 border border-primary/20"
          >
            <Mail className="w-4 h-4 shrink-0" /> {t("quotes.sendEmail")}
          </button>
          <button
            onClick={() => setArchiveDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border/60 rounded-sm text-sm text-foreground hover:bg-muted"
            title={t("quotes.archive")}
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-destructive/40 text-destructive rounded-sm text-sm hover:bg-destructive/10"
            title={t("quotes.deleteTitle")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {duplicateError && (
        <div className="p-3 rounded-sm text-sm bg-destructive/10 text-destructive border border-destructive/30 font-medium">
          {duplicateError}
        </div>
      )}

      {sendResult && (
        <div
          className={`p-3 rounded-sm text-sm border font-medium ${
            sendResult === "__success__"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-destructive/10 text-destructive border-destructive/30"
          }`}
        >
          {sendResult === "__success__" ? t("quotes.emailSent") : sendResult}
        </div>
      )}

      {/* Wall Areas — S80/S150/S200 and Total are per kit; total wall area = per kit × totalKits */}
      {(() => {
        const tk = Math.max(Number(quote.totalKits) || 1, 1);
        const totalM2PerKit = Number(quote.wallAreaM2Total) || 0;
        const totalM2Total = totalM2PerKit * tk;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/60 rounded-sm overflow-hidden border border-border/60 animate-engine-reveal [animation-delay:80ms]">
            <div className="bg-background p-5">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("quotes.s80WallArea")}
              </p>
              <p className="text-xl font-bold mt-2 tabular-nums font-mono text-foreground">
                {(Number(quote.wallAreaM2S80) || 0).toFixed(1)} m²
              </p>
            </div>
            <div className="bg-background p-5">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("quotes.s150WallArea")}
              </p>
              <p className="text-xl font-bold mt-2 tabular-nums font-mono text-foreground">
                {(Number(quote.wallAreaM2S150) || 0).toFixed(1)} m²
              </p>
            </div>
            <div className="bg-background p-5">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("quotes.s200WallArea")}
              </p>
              <p className="text-xl font-bold mt-2 tabular-nums font-mono text-foreground">
                {(Number(quote.wallAreaM2S200) || 0).toFixed(1)} m²
              </p>
            </div>
            <div className="bg-background p-5 border-l border-border/60 md:border-l">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("quotes.totalWallArea")}
              </p>
              {tk > 1 ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-2 font-mono tabular-nums">
                    {t("quotes.perKit")}: {totalM2PerKit.toFixed(1)} m²
                  </p>
                  <p className="text-lg font-bold text-foreground font-mono tabular-nums mt-1">
                    {t("quotes.totalLabel")}: {totalM2Total.toFixed(1)} m²
                  </p>
                </>
              ) : (
                <p className="text-xl font-bold mt-2 tabular-nums font-mono text-foreground">
                  {t("quotes.totalLabel")}: {totalM2Total.toFixed(1)} m²
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* SaaS quote line items */}
      {quote.items?.length > 0 && (
        <div className="rounded-sm border border-border/60 bg-background overflow-hidden animate-engine-reveal [animation-delay:120ms]">
          <button
            type="button"
            onClick={() => setMaterialLinesOpen((o) => !o)}
            className="w-full p-5 border-b border-border/60 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
          >
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {t("quotes.materialLinesCount", { count: quote.items.length })}
            </h2>
            {materialLinesOpen ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
          </button>
          {materialLinesOpen && (
            <div className="overflow-x-auto bg-background">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("quotes.description")}
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("quotes.system")}
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("quotes.qty")}
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("quotes.unitPrice")}
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("quotes.total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((line: any, i: number) => (
                    <tr
                      key={line.id ?? i}
                      className={`border-b border-border/60 last:border-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                    >
                      <td className="px-3 py-2 text-foreground">{line.description ?? line.sku ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{line.itemType ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{line.quantity ?? 0}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {fmt(Number(line.unitPrice) || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-foreground">
                        {fmt(Number(line.totalPrice) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Financial summary + taxes (canonical `quote.pricing` from SaaS API) */}
      {hasPricing && p ? (
        <div className="grid md:grid-cols-2 gap-6 animate-engine-reveal [animation-delay:160ms]">
          <div className="rounded-sm border border-border/60 bg-background p-6 space-y-5">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground border-b border-border/60 pb-3">
              {t("quotes.costBreakdown")}
            </h2>
            <div className="space-y-0 text-sm font-mono tabular-nums">
              {(() => {
                const showExw = p.factoryExwUsd != null && p.factoryExwUsd !== undefined;
                const firstRow = showExw
                  ? { label: t("quotes.exwFactoryCost"), value: p.factoryExwUsd, bold: false as boolean }
                  : {
                      label: t("quotes.basePriceVisionLatam"),
                      value: p.basePriceForPartnerUsd ?? quote.basePriceForPartner,
                      bold: false as boolean,
                    };
                const nc = Number(quote.numContainers) || 1;
                const rows: { label: string; value: unknown; bold?: boolean }[] = [
                  firstRow,
                  { label: t("quotes.fob"), value: p.afterPartnerMarkupUsd, bold: true },
                  { label: t("quotes.freightContainers", { count: nc }), value: p.freightUsd },
                  { label: t("quotes.cif"), value: p.cifUsd, bold: true },
                  { label: t("quotes.totalTaxesFees"), value: p.ruleTaxesUsd },
                  { label: t("quotes.technicalServiceLine"), value: p.technicalServiceUsd },
                  { label: t("quotes.landed"), value: p.suggestedLandedUsd ?? p.landedTotalUsd, bold: true },
                ];
                return rows;
              })().map((row) => (
                <div
                  key={row.label}
                  className={`flex justify-between gap-4 py-2.5 border-b border-border/60 last:border-0 ${
                    row.bold ? "font-semibold text-foreground border-t border-border/60 mt-1 pt-4" : ""
                  }`}
                >
                  <span className={row.bold ? "text-foreground" : "text-muted-foreground text-xs uppercase tracking-wide font-sans"}>
                    {row.label}
                  </span>
                  <span
                    className={`shrink-0 ${row.bold ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                  >
                    {fmt(Number(row.value) || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-border/60 bg-background p-6 space-y-5">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground border-b border-border/60 pb-3">
              {t("quotes.taxesFees")}
              {quote.project?.countryCode && ` (${String(quote.project.countryCode)})`}
            </h2>
            {taxLinesFromPricing.length > 0 ? (
              <div className="space-y-0 text-sm font-mono tabular-nums">
                {taxLinesFromPricing.map((tl) => {
                  const label =
                    tl.perContainer || /per container/i.test(tl.label || "")
                      ? (tl.label || "").replace(/\s*\(per container\)/gi, " (per order)")
                      : tl.label || "";
                  return (
                    <div
                      key={`${tl.order}-${tl.label}`}
                      className="flex justify-between gap-4 py-2.5 border-b border-border/60"
                    >
                      <span className="text-muted-foreground text-xs font-sans pr-2">{label}</span>
                      <span className="font-medium text-muted-foreground shrink-0">{fmt(Number(tl.computedAmount) || 0)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-semibold border-t border-border/60 pt-4 mt-1 text-foreground">
                  <span className="uppercase text-xs tracking-wide font-sans">{t("quotes.totalTaxesLabel")}</span>
                  <span>
                    {fmt(
                      taxLinesFromPricing.reduce((s, tl) => s + (Number(tl.computedAmount) || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm font-mono">{t("quotes.noTaxesApplied")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-alert-warning border border-alert-warningBorder rounded-sm p-4 text-sm text-foreground">
          {t("quotes.pricingUnavailable")}
        </div>
      )}

      {/* Total (persisted totalPrice = source of truth) */}
      <div className="rounded-sm border-2 border-engine-accent/45 bg-background p-8 animate-engine-reveal [animation-delay:200ms]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-mono font-semibold uppercase tracking-[0.16em] text-engine-accent">
              {t("quotes.landedDdpTotal")}
            </p>
            {(Number(quote.totalKits) || 0) > 0 && (
              <div className="text-muted-foreground/90 text-xs mt-4 space-y-1 font-mono tabular-nums">
                <p>
                  {quote.totalKits} kits · {quote.numContainers} container{Number(quote.numContainers) !== 1 ? "s" : ""} ·{" "}
                  {fmt(mainTotalUsd / Math.max(Number(quote.numContainers) || 1, 1))}/container
                </p>
                <p>{fmt(mainTotalUsd / Math.max(Number(quote.totalKits) || 1, 1))}/kit</p>
              </div>
            )}
          </div>
          <p className="text-5xl sm:text-6xl font-bold tabular-nums font-mono text-foreground tracking-wide">
            {fmt(mainTotalUsd)}
          </p>
        </div>
      </div>

      {/* Informational — stored values are per kit (CSV = one kit); total = per kit × totalKits. Show "Por kit" only when totalKits > 1. */}
      <div className="rounded-sm border border-border/60 bg-background p-6 animate-engine-reveal [animation-delay:240ms]">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground border-b border-border/60 pb-3 mb-5">
          {t("quotes.informational")}
        </h2>
        {(() => {
          const tk = Math.max(Number(quote.totalKits) || 1, 1);
          const m2PerKit = Number(quote.wallAreaM2Total) || 0;
          const m3PerKit = Number(quote.concreteM3) || 0;
          const kgPerKit = Number(quote.steelKgEst) || 0;
          const m2Total = m2PerKit * tk;
          const m3Total = m3PerKit * tk;
          const kgTotal = kgPerKit * tk;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border/60 rounded-sm overflow-hidden border border-border/60">
                <div className="bg-background p-4">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t("quotes.wallsM2")}
                  </p>
                  {tk > 1 && (
                    <p className="font-mono tabular-nums text-sm text-foreground">
                      {t("quotes.perKit")}: {m2PerKit.toLocaleString("en-US", { minimumFractionDigits: 2 })} m²
                    </p>
                  )}
                  <p
                    className={`font-mono tabular-nums ${tk > 1 ? "text-muted-foreground text-sm mt-1" : "text-lg font-semibold text-foreground"}`}
                  >
                    {t("quotes.totalLabel")}: {m2Total.toLocaleString("en-US", { minimumFractionDigits: 2 })} m²
                  </p>
                </div>
                <div className="bg-background p-4">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t("quotes.concreteM3")}
                  </p>
                  {tk > 1 && (
                    <p className="font-mono tabular-nums text-sm text-foreground">
                      {t("quotes.perKit")}: {m3PerKit.toLocaleString("en-US", { minimumFractionDigits: 2 })} m³
                    </p>
                  )}
                  <p
                    className={`font-mono tabular-nums ${tk > 1 ? "text-muted-foreground text-sm mt-1" : "text-lg font-semibold text-foreground"}`}
                  >
                    {t("quotes.totalLabel")}: {m3Total.toLocaleString("en-US", { minimumFractionDigits: 2 })} m³
                  </p>
                </div>
                <div className="bg-background p-4">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t("quotes.steelKg")}
                  </p>
                  {tk > 1 && (
                    <p className="font-mono tabular-nums text-sm text-foreground">
                      {t("quotes.perKit")}: {kgPerKit.toLocaleString("en-US", { minimumFractionDigits: 1 })} kg
                    </p>
                  )}
                  <p
                    className={`font-mono tabular-nums ${tk > 1 ? "text-muted-foreground text-sm mt-1" : "text-lg font-semibold text-foreground"}`}
                  >
                    {t("quotes.totalLabel")}: {kgTotal.toLocaleString("en-US", { minimumFractionDigits: 1 })} kg
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-border/60 pt-5 font-mono tabular-nums">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">{t("quotes.panelWeight")}</p>
                  <p className="font-semibold text-foreground mt-1">{(Number(quote.totalWeightKg) || 0).toFixed(0)} kg</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">{t("quotes.panelVolume")}</p>
                  <p className="font-semibold text-foreground mt-1">{(Number(quote.totalVolumeM3) || 0).toFixed(2)} m³</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Activity */}
      <div className="rounded-sm border border-border/60 bg-background overflow-hidden animate-engine-reveal [animation-delay:280ms]">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-2 bg-muted/25">
          <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.12em] text-foreground">{t("quotes.activity")}</h2>
        </div>
        <div className="p-6">
          {loadingAudit ? (
            <p className="text-muted-foreground text-sm font-mono">{t("common.loading")}</p>
          ) : auditLog.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("quotes.noActivityYet")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between text-sm first:pt-0">
                  <span className="text-foreground font-sans leading-snug">{formatQuoteAction(entry.action, entry.meta)}</span>
                  <span className="text-muted-foreground text-xs font-mono tabular-nums shrink-0">
                    {entry.userName ?? t("projects.system")} · {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit quote modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50">
          <div className="bg-background border border-border/60 rounded-sm p-6 w-full max-w-md m-4 ring-1 ring-border/60">
            <h3 className="font-semibold text-lg mb-1 text-foreground tracking-tight">{t("quotes.editQuote")}</h3>
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/60 pb-3">
              {quote.quoteNumber ?? quote.id.slice(0, 8).toUpperCase()}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("common.status")}
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background"
                >
                  <option value="draft">{t("quotes.draft")}</option>
                  <option value="sent">{t("quotes.sent")}</option>
                  <option value="accepted">{t("quotes.accepted")}</option>
                  <option value="rejected">{t("quotes.rejected")}</option>
                  <option value="expired">{t("quotes.expired")}</option>
                  <option value="archived">{t("quotes.archived")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("quotes.notes")}
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background"
                  placeholder={t("quotes.internalNotesPlaceholder")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 border border-border/60 rounded-sm text-sm text-foreground hover:bg-muted font-medium"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-sm border border-vbt-orange/30 bg-vbt-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF options dialog */}
      {pdfDialog && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50">
          <div className="bg-background border border-border/60 rounded-sm p-6 w-full max-w-md m-4 ring-1 ring-border/60">
            <h3 className="font-semibold text-lg mb-1 text-foreground">{t("quotes.pdfOptions")}</h3>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">{t("quotes.pdf")}</p>
            <div className="space-y-3 text-sm border-t border-border/60 pt-4">
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={pdfOptions.includeMaterialLines}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, includeMaterialLines: e.target.checked }))}
                  className="rounded-sm border-input"
                />
                {t("quotes.includeMaterialLinesPdf")}
              </label>
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={pdfOptions.showUnitPrice}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, showUnitPrice: e.target.checked }))}
                  className="rounded-sm border-input"
                />
                {t("quotes.showUnitPricePdf")}
              </label>
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={pdfOptions.includeAlerts}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, includeAlerts: e.target.checked }))}
                  className="rounded-sm border-input"
                />
                {t("quotes.includeMinRunAlerts")}
              </label>
            </div>
            {/* PDF: legacy `/api/quotes/:id/pdf` hasta que exista SaaS. */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPdfDialog(false)}
                className="px-4 py-2 border border-border/60 rounded-sm text-sm text-foreground hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
              <a
                href={`/api/quotes/${quote.id}/pdf?includeAlerts=${pdfOptions.includeAlerts ? "1" : "0"}&includeMaterialLines=${pdfOptions.includeMaterialLines ? "1" : "0"}&showUnitPrice=${pdfOptions.showUnitPrice ? "1" : "0"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-semibold hover:opacity-90 border border-primary/20"
                onClick={() => setPdfDialog(false)}
              >
                <Download className="w-4 h-4" /> {t("quotes.downloadPdf")}
              </a>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={archiveDialog}
        onOpenChange={setArchiveDialog}
        title={t("quotes.archiveQuoteTitle")}
        description={t("quotes.archiveQuoteMsg")}
        confirmLabel={t("quotes.archive")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("quotes.archiving")}
        variant="primary"
        loading={archiving}
        onConfirm={archive}
      />

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title={t("quotes.deleteQuoteTitle")}
        description={t("quotes.deleteQuoteMsg")}
        confirmLabel={t("quotes.deleteTitle")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("quotes.deleting")}
        variant="danger"
        loading={deleting}
        onConfirm={deletePermanently}
      />

      {/* Email Dialog */}
      {emailDialog && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50">
          <div className="bg-background border border-border/60 rounded-sm p-6 w-full max-w-md m-4 ring-1 ring-border/60">
            <h3 className="font-semibold text-lg mb-4 text-foreground">{t("quotes.sendQuoteEmail")}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("quotes.to")} *
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={t("quotes.emailPlaceholder")}
                  className="w-full px-3 py-2 border border-input rounded-sm text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("quotes.message")}
                </label>
                <textarea
                  rows={3}
                  value={emailMsg}
                  onChange={(e) => setEmailMsg(e.target.value)}
                  placeholder={t("quotes.messagePlaceholder")}
                  className="w-full px-3 py-2 border border-input rounded-sm text-sm resize-none bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {sendResult && sendResult !== "__success__" && (
                <p className="text-destructive text-sm border border-destructive/30 rounded-sm px-2 py-1.5 bg-destructive/5">{sendResult}</p>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setEmailDialog(false)}
                  className="px-4 py-2 border border-border/60 rounded-sm text-sm hover:bg-muted"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !emailTo}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-semibold disabled:opacity-50 border border-primary/20"
                >
                  {sending ? t("quotes.sending") : t("quotes.send")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

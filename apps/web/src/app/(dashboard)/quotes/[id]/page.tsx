"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Mail, Archive, Trash2, ChevronDown, ChevronRight, Pencil, Activity, ShoppingCart } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS_KEYS: Record<string, string> = {
  DRAFT: "quotes.draft",
  SENT: "quotes.sent",
  ARCHIVED: "quotes.archived",
  CANCELLED: "quotes.cancelled",
};

export default function QuoteDetailPage() {
  const t = useT();
  const params = useParams();
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
  const [editStatus, setEditStatus] = useState("DRAFT");

  const fetchAudit = () => {
    fetch(`/api/quotes/${params.id}/audit`)
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
    fetch(`/api/quotes/${params.id}`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : null;
          setQuote(d);
          setEditNotes(d?.notes ?? "");
          setEditStatus(d?.status ?? "DRAFT");
        } catch {
          setQuote(null);
        } finally {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [params.id]);

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

  const sendEmail = async () => {
    if (!emailTo) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch(`/api/quotes/${params.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo, message: emailMsg }),
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
      setQuote((prev: any) => ({ ...prev, status: "SENT" }));
      fetchAudit();
    } else {
      setSendResult(data.error ?? t("auth.errorGeneric"));
    }
  };

  const archive = async () => {
    setArchiving(true);
    const res = await fetch(`/api/quotes/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setArchiving(false);
    setArchiveDialog(false);
    if (res.ok) {
      setQuote((prev: any) => ({ ...prev, status: "ARCHIVED" }));
      fetchAudit();
    }
  };

  const deletePermanently = async () => {
    setDeleting(true);
    const res = await fetch(`/api/quotes/${params.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteDialog(false);
    if (res.ok) router.push("/quotes");
  };

  const openEdit = () => {
    setEditNotes(quote?.notes ?? "");
    setEditStatus(quote?.status ?? "DRAFT");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await fetch(`/api/quotes/${params.id}`, {
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

  if (loading) return <div className="p-8 text-center text-gray-400">{t("common.loading")}</div>;
  if (!quote || quote.error) return <div className="p-8 text-center text-red-500">{t("quotes.quoteNotFound")}</div>;

  const snapshot = (quote.snapshot as any) || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {quote.quoteNumber ?? quote.id.slice(0, 8).toUpperCase()}
              </h1>
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                quote.status === "SENT" ? "bg-green-100 text-green-700" :
                quote.status === "DRAFT" ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-600"
              }`}>{quote.status}</span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              {quote.project?.name}
              {quote.project?.client && ` · ${quote.project.client}`}
              {quote.country && ` → ${quote.country.name}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {quote.projectId && (
            <Link
              href={`/sales/new?quoteId=${quote.id}&projectId=${quote.projectId}&clientId=${(quote.project as any)?.clientId ?? ""}`}
              className="inline-flex items-center gap-2 px-3 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600"
            >
              <ShoppingCart className="w-4 h-4" /> {t("quotes.createSale")}
            </Link>
          )}
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" /> {t("common.edit")}
          </button>
          <button
            onClick={() => setPdfDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> {t("quotes.pdf")}
          </button>
          <button
            onClick={() => setEmailDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900"
          >
            <Mail className="w-4 h-4" /> {t("quotes.sendEmail")}
          </button>
          <button
            onClick={() => setArchiveDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            title={t("quotes.archive")}
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
            title={t("quotes.deleteTitle")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {sendResult && (
        <div className={`p-3 rounded-lg text-sm ${sendResult === "__success__" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {sendResult === "__success__" ? t("quotes.emailSent") : sendResult}
        </div>
      )}

      {/* Wall Areas — S80/S150/S200 and Total are per kit; total wall area = per kit × totalKits */}
      {(() => {
        const tk = Math.max(Number(quote.totalKits) || 1, 1);
        const totalM2PerKit = Number(quote.wallAreaM2Total) || 0;
        const totalM2Total = totalM2PerKit * tk;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 uppercase">{t("quotes.s80WallArea")}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{(Number(quote.wallAreaM2S80) || 0).toFixed(1)} m²</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 uppercase">{t("quotes.s150WallArea")}</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{(Number(quote.wallAreaM2S150) || 0).toFixed(1)} m²</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 uppercase">{t("quotes.s200WallArea")}</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{(Number(quote.wallAreaM2S200) || 0).toFixed(1)} m²</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 uppercase">{t("quotes.totalWallArea")}</p>
              {tk > 1 ? (
                <>
                  <p className="text-sm font-semibold text-gray-800 mt-1">{t("quotes.perKit")}: {totalM2PerKit.toFixed(1)} m²</p>
                  <p className="text-lg font-bold text-gray-800">{t("quotes.totalLabel")}: {totalM2Total.toFixed(1)} m²</p>
                </>
              ) : (
                <p className="text-xl font-bold text-gray-800 mt-1">{t("quotes.totalLabel")}: {totalM2Total.toFixed(1)} m²</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Material Lines (collapsible) */}
      {quote.lines?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            type="button"
            onClick={() => setMaterialLinesOpen((o) => !o)}
            className="w-full p-4 border-b border-gray-100 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
          >
            <h2 className="font-semibold text-gray-800">{t("quotes.materialLinesCount", { count: quote.lines.length })}</h2>
            {materialLinesOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>
          {materialLinesOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t("quotes.description")}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t("quotes.system")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t("quotes.qty")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t("quotes.lengthM")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">m²</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t("quotes.unitPrice")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t("quotes.total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {quote.lines.map((line: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                      <td className="px-3 py-2 text-gray-800">{line.description}</td>
                      <td className="px-3 py-2 text-gray-500">{line.systemCode ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{line.qty}</td>
                      <td className="px-3 py-2 text-right">{((line.heightMm ?? 0) / 1000).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{(line.m2Line ?? 0).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{fmt(line.unitPrice ?? 0)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">{t("quotes.costBreakdown")}</h2>
          <div className="space-y-2 text-sm">
            {(() => {
              const showExw = quote.factoryCostUsd != null || quote.factoryCostTotal != null;
              const firstRow = showExw
                ? { label: t("quotes.exwFactoryCost"), value: quote.factoryCostUsd ?? quote.factoryCostTotal, bold: false as boolean }
                : { label: t("quotes.basePriceVisionLatam"), value: quote.basePriceForPartner, bold: false as boolean };
              const rows: { label: string; value: unknown; bold?: boolean }[] = [
                firstRow,
                { label: t("quotes.fob"), value: quote.fobUsd, bold: true },
                { label: t("quotes.freightContainers", { count: quote.numContainers ?? 0 }), value: quote.freightCostUsd },
                { label: t("quotes.cif"), value: quote.cifUsd, bold: true },
                { label: t("quotes.totalTaxesFees"), value: quote.taxesFeesUsd ?? 0 },
                { label: t("quotes.landed"), value: quote.landedDdpUsd, bold: true },
              ];
              return rows;
            })().map((row) => (
              <div key={row.label} className={`flex justify-between ${row.bold ? "font-semibold border-t pt-2" : ""}`}>
                <span className={row.bold ? "" : "text-gray-500"}>{row.label}</span>
                <span>{fmt(Number(row.value) || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tax Lines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">{t("quotes.taxesFees")} {quote.country && `(${quote.country.name})`}</h2>
          {quote.taxLines?.length > 0 ? (
            <div className="space-y-2 text-sm">
              {quote.taxLines.map((tl: any) => {
                const label = (tl.perContainer || /per container/i.test(tl.label || ""))
                  ? (tl.label || "").replace(/\s*\(per container\)/gi, " (per order)")
                  : (tl.label || "");
                return (
                  <div key={tl.id} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{fmt(Number(tl.computedAmount) || 0)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t("quotes.totalTaxesLabel")}</span>
                <span>{fmt(Number(quote.taxesFeesUsd) || 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">{t("quotes.noTaxRules")}</p>
          )}
        </div>
      </div>

      {/* DDP Total */}
      <div className="bg-vbt-blue rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70">{t("quotes.landedDdpTotal")}</p>
            {(Number(quote.totalKits) || 0) > 0 && (
              <div className="text-white/50 text-sm mt-1 space-y-0.5">
                <p>
                  {quote.totalKits} kits · {quote.numContainers} container{Number(quote.numContainers) !== 1 ? "s" : ""} ·{" "}
                  {fmt((Number(quote.landedDdpUsd) || 0) / Math.max(Number(quote.numContainers) || 1, 1))}/container
                </p>
                <p>
                  {fmt((Number(quote.landedDdpUsd) || 0) / Math.max(Number(quote.totalKits) || 1, 1))}/kit
                </p>
              </div>
            )}
          </div>
          <p className="text-4xl font-bold text-white">{fmt(Number(quote.landedDdpUsd) || 0)}</p>
        </div>
      </div>

      {/* Informational — stored values are per kit (CSV = one kit); total = per kit × totalKits. Show "Por kit" only when totalKits > 1. */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">{t("quotes.informational")}</h2>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs font-medium uppercase mb-1">{t("quotes.wallsM2")}</p>
                  {tk > 1 && <p className="font-semibold text-gray-800">{t("quotes.perKit")}: {m2PerKit.toLocaleString("en-US", { minimumFractionDigits: 2 })} m²</p>}
                  <p className={tk > 1 ? "text-gray-600" : "font-semibold text-gray-800"}>{t("quotes.totalLabel")}: {m2Total.toLocaleString("en-US", { minimumFractionDigits: 2 })} m²</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs font-medium uppercase mb-1">{t("quotes.concreteM3")}</p>
                  {tk > 1 && <p className="font-semibold text-gray-800">{t("quotes.perKit")}: {m3PerKit.toLocaleString("en-US", { minimumFractionDigits: 2 })} m³</p>}
                  <p className={tk > 1 ? "text-gray-600" : "font-semibold text-gray-800"}>{t("quotes.totalLabel")}: {m3Total.toLocaleString("en-US", { minimumFractionDigits: 2 })} m³</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs font-medium uppercase mb-1">{t("quotes.steelKg")}</p>
                  {tk > 1 && <p className="font-semibold text-gray-800">{t("quotes.perKit")}: {kgPerKit.toLocaleString("en-US", { minimumFractionDigits: 1 })} kg</p>}
                  <p className={tk > 1 ? "text-gray-600" : "font-semibold text-gray-800"}>{t("quotes.totalLabel")}: {kgTotal.toLocaleString("en-US", { minimumFractionDigits: 1 })} kg</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-gray-100 pt-3">
                <div><p className="text-gray-400 text-xs">{t("quotes.panelWeight")}</p><p className="font-semibold">{(Number(quote.totalWeightKg) || 0).toFixed(0)} kg</p></div>
                <div><p className="text-gray-400 text-xs">{t("quotes.panelVolume")}</p><p className="font-semibold">{(Number(quote.totalVolumeM3) || 0).toFixed(2)} m³</p></div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800">{t("quotes.activity")}</h2>
        </div>
        <div className="p-5">
          {loadingAudit ? (
            <p className="text-gray-400 text-sm">{t("common.loading")}</p>
          ) : auditLog.length === 0 ? (
            <p className="text-gray-400 text-sm">{t("quotes.noActivityYet")}</p>
          ) : (
            <ul className="space-y-3">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-700">{formatQuoteAction(entry.action, entry.meta)}</span>
                  <span className="text-gray-400 text-xs">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-4">{t("quotes.editQuote")}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.status")}</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="DRAFT">{t("quotes.draft")}</option>
                  <option value="SENT">{t("quotes.sent")}</option>
                  <option value="ARCHIVED">{t("quotes.archived")}</option>
                  <option value="CANCELLED">{t("quotes.cancelled")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("quotes.notes")}</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t("quotes.internalNotesPlaceholder")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF options dialog */}
      {pdfDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-4">{t("quotes.pdfOptions")}</h3>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.includeMaterialLines}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, includeMaterialLines: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t("quotes.includeMaterialLinesPdf")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.showUnitPrice}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, showUnitPrice: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t("quotes.showUnitPricePdf")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.includeAlerts}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, includeAlerts: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t("quotes.includeMinRunAlerts")}
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setPdfDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{t("common.cancel")}</button>
              <a
                href={`/api/quotes/${quote.id}/pdf?includeAlerts=${pdfOptions.includeAlerts ? "1" : "0"}&includeMaterialLines=${pdfOptions.includeMaterialLines ? "1" : "0"}&showUnitPrice=${pdfOptions.showUnitPrice ? "1" : "0"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-4">{t("quotes.sendQuoteEmail")}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("quotes.to")} *</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={t("quotes.emailPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("quotes.message")}</label>
                <textarea
                  rows={3}
                  value={emailMsg}
                  onChange={(e) => setEmailMsg(e.target.value)}
                  placeholder={t("quotes.messagePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              {sendResult && sendResult !== "__success__" && (
                <p className="text-red-600 text-sm">{sendResult}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setEmailDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("common.cancel")}</button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !emailTo}
                  className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50"
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

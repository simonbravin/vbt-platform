"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Mail, Archive, Trash2, ChevronDown, ChevronRight, Pencil, Activity } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function QuoteDetailPage() {
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
      .then((r) => r.json())
      .then((data) => { setAuditLog(Array.isArray(data) ? data : []); setLoadingAudit(false); })
      .catch(() => setLoadingAudit(false));
  };

  useEffect(() => {
    fetch(`/api/quotes/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setQuote(d);
        setEditNotes(d?.notes ?? "");
        setEditStatus(d?.status ?? "DRAFT");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!quote?.id) return;
    setLoadingAudit(true);
    fetch(`/api/quotes/${quote.id}/audit`)
      .then((r) => r.json())
      .then((data) => { setAuditLog(Array.isArray(data) ? data : []); setLoadingAudit(false); })
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
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setSendResult("Email sent successfully!");
      setEmailDialog(false);
      setQuote((prev: any) => ({ ...prev, status: "SENT" }));
      fetchAudit();
    } else {
      setSendResult(data.error ?? "Failed to send email");
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
      const updated = await res.json();
      setQuote(updated);
      setEditOpen(false);
      fetchAudit();
    }
  };

  const formatQuoteAction = (action: string, meta: { changed?: string[] } | null) => {
    if (action === "QUOTE_CREATED") return "Quote created";
    if (action === "QUOTE_ARCHIVED") return "Archived";
    if (action === "QUOTE_UPDATED" && meta?.changed?.length) return `Updated: ${meta.changed.join(", ")}`;
    if (action === "QUOTE_DELETED") return "Deleted";
    if (action === "QUOTE_SENT") return "Email sent";
    return action.replace(/_/g, " ").toLowerCase();
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!quote || quote.error) return <div className="p-8 text-center text-red-500">Quote not found</div>;

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

        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => setPdfDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => setEmailDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900"
          >
            <Mail className="w-4 h-4" /> Send Email
          </button>
          <button
            onClick={() => setArchiveDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            title="Archivar"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
            title="Eliminar definitivamente"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {sendResult && (
        <div className={`p-3 rounded-lg text-sm ${sendResult.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {sendResult}
        </div>
      )}

      {/* Wall Areas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "S80 Wall Area", value: `${(Number(quote.wallAreaM2S80) || 0).toFixed(1)} m²` },
          { label: "S150 Wall Area", value: `${(Number(quote.wallAreaM2S150) || 0).toFixed(1)} m²` },
          { label: "S200 Wall Area", value: `${(Number(quote.wallAreaM2S200) || 0).toFixed(1)} m²` },
          { label: "Total Wall Area", value: `${(Number(quote.wallAreaM2Total) || 0).toFixed(1)} m²` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 uppercase">{s.label}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Material Lines (collapsible) */}
      {quote.lines?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            type="button"
            onClick={() => setMaterialLinesOpen((o) => !o)}
            className="w-full p-4 border-b border-gray-100 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
          >
            <h2 className="font-semibold text-gray-800">Material Lines ({quote.lines.length})</h2>
            {materialLinesOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>
          {materialLinesOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">System</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Length (m)</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">m²</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
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
          <h2 className="font-semibold text-gray-800">Cost Breakdown</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: "EXW (Factory cost)", value: quote.factoryCostUsd },
              { label: "FOB", value: quote.fobUsd, bold: true },
              { label: `Freight (${quote.numContainers} containers)`, value: quote.freightCostUsd },
              { label: "CIF", value: quote.cifUsd, bold: true },
              { label: "Total taxes & fees", value: quote.taxesFeesUsd ?? 0 },
              { label: "Landed DDP", value: quote.landedDdpUsd, bold: true },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between ${row.bold ? "font-semibold border-t pt-2" : ""}`}>
                <span className={row.bold ? "" : "text-gray-500"}>{row.label}</span>
                <span>{fmt(Number(row.value) || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tax Lines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Taxes & Fees {quote.country && `(${quote.country.name})`}</h2>
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
                <span>Total Taxes</span>
                <span>{fmt(Number(quote.taxesFeesUsd) || 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No tax rules applied</p>
          )}
        </div>
      </div>

      {/* DDP Total */}
      <div className="bg-vbt-blue rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70">Landed / DDP Total</p>
            {(Number(quote.totalKits) || 0) > 0 && (
              <p className="text-white/50 text-sm mt-1">
                {quote.totalKits} kits · {quote.numContainers} containers ·{" "}
                {fmt((Number(quote.landedDdpUsd) || 0) / Math.max(Number(quote.numContainers) || 1, 1))}/container
              </p>
            )}
          </div>
          <p className="text-4xl font-bold text-white">{fmt(Number(quote.landedDdpUsd) || 0)}</p>
        </div>
      </div>

      {/* Informational */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Informational (not in cost)</h2>
        {(() => {
          const tk = Math.max(Number(quote.totalKits) || 1, 1);
          const m2 = Number(quote.wallAreaM2Total) || 0;
          const m3 = Number(quote.concreteM3) || 0;
          const kg = Number(quote.steelKgEst) || 0;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs font-medium uppercase mb-1">Muros (m²)</p>
                  <p className="font-semibold text-gray-800">Por kit: {(m2 / tk).toLocaleString("en-US", { minimumFractionDigits: 2 })} m²</p>
                  <p className="text-gray-600">Total: {m2.toLocaleString("en-US", { minimumFractionDigits: 2 })} m²</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs font-medium uppercase mb-1">Hormigón (m³)</p>
                  <p className="font-semibold text-gray-800">Por kit: {(m3 / tk).toLocaleString("en-US", { minimumFractionDigits: 2 })} m³</p>
                  <p className="text-gray-600">Total: {m3.toLocaleString("en-US", { minimumFractionDigits: 2 })} m³</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs font-medium uppercase mb-1">Acero (kg)</p>
                  <p className="font-semibold text-gray-800">Por kit: {(kg / tk).toLocaleString("en-US", { minimumFractionDigits: 1 })} kg</p>
                  <p className="text-gray-600">Total: {kg.toLocaleString("en-US", { minimumFractionDigits: 1 })} kg</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-gray-100 pt-3">
                <div><p className="text-gray-400 text-xs">Panel Weight</p><p className="font-semibold">{(Number(quote.totalWeightKg) || 0).toFixed(0)} kg</p></div>
                <div><p className="text-gray-400 text-xs">Panel Volume</p><p className="font-semibold">{(Number(quote.totalVolumeM3) || 0).toFixed(2)} m³</p></div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Activity</h2>
        </div>
        <div className="p-5">
          {loadingAudit ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : auditLog.length === 0 ? (
            <p className="text-gray-400 text-sm">No activity yet</p>
          ) : (
            <ul className="space-y-3">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-700">{formatQuoteAction(entry.action, entry.meta)}</span>
                  <span className="text-gray-400 text-xs">
                    {entry.userName ?? "System"} · {new Date(entry.createdAt).toLocaleString()}
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
            <h3 className="font-semibold text-lg mb-4">Edit quote</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Internal notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF options dialog */}
      {pdfDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-4">PDF options</h3>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.includeMaterialLines}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, includeMaterialLines: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Include Material Lines
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.showUnitPrice}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, showUnitPrice: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Show unit price (in Material Lines)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.includeAlerts}
                  onChange={(e) => setPdfOptions((o) => ({ ...o, includeAlerts: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Include below min run alerts
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setPdfDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <a
                href={`/api/quotes/${quote.id}/pdf?includeAlerts=${pdfOptions.includeAlerts ? "1" : "0"}&includeMaterialLines=${pdfOptions.includeMaterialLines ? "1" : "0"}&showUnitPrice=${pdfOptions.showUnitPrice ? "1" : "0"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900"
                onClick={() => setPdfDialog(false)}
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation dialog */}
      {archiveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-2">Archivar cotización</h3>
            <p className="text-gray-600 text-sm mb-6">¿Archivar esta cotización? Podrás verla en el listado con estado Archivada.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={archive} disabled={archiving} className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {archiving ? "Archivando..." : "Archivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete permanently dialog */}
      {deleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-2 text-red-700">Eliminar cotización</h3>
            <p className="text-gray-600 text-sm mb-6">¿Eliminar esta cotización de forma permanente? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={deletePermanently} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Dialog */}
      {emailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
            <h3 className="font-semibold text-lg mb-4">Send Quote by Email</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                <textarea
                  rows={3}
                  value={emailMsg}
                  onChange={(e) => setEmailMsg(e.target.value)}
                  placeholder="Add a personal message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
              {sendResult && !sendResult.includes("success") && (
                <p className="text-red-600 text-sm">{sendResult}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setEmailDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !emailTo}
                  className="px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { INVOICED_BASIS_OPTIONS } from "@/lib/sales";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";

/** Only these statuses are editable; Paid / Partially paid / Due are set automatically by payments and due dates. */
const statusOptions = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;

type InvoiceLine = { entityId: string; amountUsd: number; dueDate: string; sequence: number; referenceNumber: string; notes: string };
type Entity = { id: string; name: string; slug?: string };

function validateFinancials(data: { exwUsd: number; fobUsd: number; cifUsd: number; landedDdpUsd: number }): string | null {
  if (data.exwUsd < 0 || data.fobUsd < 0 || data.cifUsd < 0 || data.landedDdpUsd < 0) return "Amounts cannot be negative.";
  if (data.landedDdpUsd < data.cifUsd) return "Landed DDP must be ≥ CIF.";
  if (data.cifUsd < data.fobUsd) return "CIF must be ≥ FOB.";
  if (data.fobUsd < data.exwUsd) return "FOB must be ≥ EXW.";
  return null;
}

function getMaxInvoiced(basis: string, exw: number, fob: number, cif: number, ddp: number): number {
  const b = (basis || "DDP").toUpperCase();
  if (b === "EXW") return exw;
  if (b === "FOB") return fob;
  if (b === "CIF") return cif;
  return ddp;
}

export function EditSaleClient({ saleId }: { saleId: string }) {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<any>(null);
  const [status, setStatus] = useState<string>("DRAFT");
  const [exwUsd, setExwUsd] = useState(0);
  const [commissionPct, setCommissionPct] = useState(0);
  const [commissionAmountUsd, setCommissionAmountUsd] = useState(0);
  const [fobUsd, setFobUsd] = useState(0);
  const [freightUsd, setFreightUsd] = useState(0);
  const [cifUsd, setCifUsd] = useState(0);
  const [taxesFeesUsd, setTaxesFeesUsd] = useState(0);
  const [landedDdpUsd, setLandedDdpUsd] = useState(0);
  const [invoicedBasis, setInvoicedBasis] = useState<"EXW" | "FOB" | "CIF" | "DDP">("DDP");
  const [notes, setNotes] = useState("");
  const [invoices, setInvoices] = useState<InvoiceLine[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sales/entities").then((r) => r.json()).then((d) => setEntities(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    fetch(`/api/sales/${saleId}`)
      .then((r) => r.json())
      .then((d) => {
        setSale(d);
        if (d) {
          const round2 = (n: number) => Math.round(n * 100) / 100;
          setStatus(["PAID", "PARTIALLY_PAID", "DUE"].includes(d.status) ? "" : (d.status ?? "DRAFT"));
          setExwUsd(round2(d.exwUsd ?? 0));
          setCommissionPct(round2(d.commissionPct ?? 0));
          setCommissionAmountUsd(round2(d.commissionAmountUsd ?? 0));
          setFobUsd(round2(d.fobUsd ?? 0));
          setFreightUsd(round2(d.freightUsd ?? 0));
          setCifUsd(round2(d.cifUsd ?? 0));
          setTaxesFeesUsd(round2(d.taxesFeesUsd ?? 0));
          setLandedDdpUsd(round2(d.landedDdpUsd ?? 0));
          setInvoicedBasis((d.invoicedBasis || "DDP").toUpperCase() as "EXW" | "FOB" | "CIF" | "DDP");
          setNotes(d.notes ?? "");
          setInvoices(
            (d.invoices ?? []).map((inv: { entityId: string; amountUsd: number; dueDate: string | null; sequence?: number; referenceNumber?: string | null; notes?: string | null }) => ({
              entityId: inv.entityId,
              amountUsd: round2(inv.amountUsd ?? 0),
              dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "",
              sequence: inv.sequence ?? 1,
              referenceNumber: inv.referenceNumber ?? "",
              notes: inv.notes ?? "",
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [saleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validateFinancials({ exwUsd, fobUsd, cifUsd, landedDdpUsd });
    if (err) {
      setError(err);
      return;
    }
    const validInvoices = invoices.filter((inv) => !!inv.entityId);
    const invoicesSum = validInvoices.reduce((a, inv) => a + Number(inv.amountUsd), 0);
    const maxInvoiced = getMaxInvoiced(invoicedBasis, exwUsd, fobUsd, cifUsd, landedDdpUsd);
    if (validInvoices.length > 0 && invoicesSum > maxInvoiced) {
      setError(`Sum of invoice amounts (${invoicesSum.toFixed(2)}) cannot exceed invoiced amount for selected basis (${maxInvoiced.toFixed(2)}).`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(status !== "" && { status: status as string }),
          exwUsd: Number(exwUsd.toFixed(2)),
          commissionPct: Number(commissionPct.toFixed(2)),
          commissionAmountUsd: Number(commissionAmountUsd.toFixed(2)),
          fobUsd: Number(fobUsd.toFixed(2)),
          freightUsd: Number(freightUsd.toFixed(2)),
          cifUsd: Number(cifUsd.toFixed(2)),
          taxesFeesUsd: Number(taxesFeesUsd.toFixed(2)),
          landedDdpUsd: Number(landedDdpUsd.toFixed(2)),
          invoicedBasis,
          notes: notes || undefined,
          invoices: invoices
            .filter((inv) => !!inv.entityId)
            .map((inv) => ({
              entityId: inv.entityId,
              amountUsd: Number(Number(inv.amountUsd).toFixed(2)),
              dueDate: inv.dueDate ? inv.dueDate : null,
              sequence: inv.sequence || 1,
              referenceNumber: inv.referenceNumber?.trim() || undefined,
              notes: inv.notes || undefined,
            })),
        }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to update");
      router.push(`/sales/${saleId}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-500">{t("partner.sales.loading")}</div>;
  if (!sale) return <div className="py-8 text-center text-gray-500">{t("partner.sales.saleNotFound")}</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex gap-4">
        <Link href={`/sales/${saleId}`} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to sale
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-2">Sale</h2>
        <p className="text-sm text-gray-600">
          {sale.saleNumber} · {sale.client?.name} · {sale.project?.name}
          {sale.quote ? ` · Quote ${sale.quote.quoteNumber ?? sale.quote.id}` : ""} · Qty {sale.quantity}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Status</h2>
        {["PAID", "PARTIALLY_PAID", "DUE"].includes(sale.status) ? (
          <>
            <p className="text-sm text-gray-600">
              Status: <strong>{sale.status.replace(/_/g, " ")}</strong> — set automatically from payments and due dates.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Change status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Keep as is</option>
                <option value="CANCELLED">Cancel sale</option>
              </select>
            </div>
          </>
        ) : (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        )}
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Sales condition (Incoterm for invoiced amount)</label>
          <select value={invoicedBasis} onChange={(e) => setInvoicedBasis(e.target.value as "EXW" | "FOB" | "CIF" | "DDP")} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {INVOICED_BASIS_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Financials (USD)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["EXW", exwUsd, setExwUsd, true],
              ["Commission %", commissionPct, setCommissionPct, false],
              [t("partner.sales.commissionAmount"), commissionAmountUsd, setCommissionAmountUsd, true],
              ["FOB", fobUsd, setFobUsd, true],
              ["Freight", freightUsd, setFreightUsd, true],
              ["CIF", cifUsd, setCifUsd, true],
              ["Taxes & fees", taxesFeesUsd, setTaxesFeesUsd, true],
              ["Landed DDP", landedDdpUsd, setLandedDdpUsd, true],
            ] as [string, number, (n: number) => void, boolean][]
          ).map(([label, val, setter, isCurrency]) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              {isCurrency ? (
                <div className="relative rounded-lg border border-gray-300">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={typeof val === "number" ? Number(val.toFixed(2)) : ""}
                    onChange={(e) => (setter as (n: number) => void)(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border-0 text-sm bg-transparent"
                  />
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={typeof val === "number" ? Number(val.toFixed(2)) : ""}
                  onChange={(e) => (setter as (n: number) => void)(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Invoices / due dates</h2>
          <button
            type="button"
            onClick={() => setInvoices((prev) => [...prev, { entityId: "", amountUsd: 0, dueDate: "", sequence: prev.length + 1, referenceNumber: "", notes: "" }])}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-vbt-blue hover:bg-blue-50 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Add line
          </button>
        </div>
        <p className="text-xs text-gray-500">Sum of amounts cannot exceed the invoiced amount for the selected sales condition.</p>
        {invoices.filter((i) => i.entityId).length > 0 && (() => {
          const sum = invoices.filter((i) => i.entityId).reduce((a, i) => a + Number(i.amountUsd), 0);
          const max = getMaxInvoiced(invoicedBasis, exwUsd, fobUsd, cifUsd, landedDdpUsd);
          return sum > max ? <p className="text-sm text-amber-600">Sum (${sum.toFixed(2)}) exceeds max for {invoicedBasis} (${max.toFixed(2)}). Reduce amounts or change sales condition.</p> : null;
        })()}
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-500">No invoice lines. Click &quot;Add line&quot; to define due dates by entity.</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv, idx) => (
              <li key={idx} className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Entity</label>
                  <select
                    value={inv.entityId}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, entityId: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select entity</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Amount $</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={inv.amountUsd === 0 ? "" : inv.amountUsd}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, amountUsd: parseFloat(e.target.value) || 0 } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Due date</label>
                  <input
                    type="date"
                    value={inv.dueDate}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, dueDate: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Seq</label>
                  <input
                    type="number"
                    min={1}
                    value={inv.sequence}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, sequence: parseInt(e.target.value, 10) || 1 } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="min-w-[120px] flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Ref. number</label>
                  <input
                    type="text"
                    value={inv.referenceNumber}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, referenceNumber: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="External invoice #"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Notes</label>
                  <input
                    type="text"
                    value={inv.notes}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, notes: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="Optional"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setInvoices((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  title={t("partner.sales.removeLine")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
          {saving ? t("common.saving") : t("partner.sales.saveChanges")}
        </button>
        <Link href={`/sales/${saleId}`} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
      </div>
    </form>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const statusOptions = ["DRAFT", "CONFIRMED", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;

function validateFinancials(data: { exwUsd: number; fobUsd: number; cifUsd: number; landedDdpUsd: number }): string | null {
  if (data.exwUsd < 0 || data.fobUsd < 0 || data.cifUsd < 0 || data.landedDdpUsd < 0) return "Amounts cannot be negative.";
  if (data.landedDdpUsd < data.cifUsd) return "Landed DDP must be ≥ CIF.";
  if (data.cifUsd < data.fobUsd) return "CIF must be ≥ FOB.";
  if (data.fobUsd < data.exwUsd) return "FOB must be ≥ EXW.";
  return null;
}

export function EditSaleClient({ saleId }: { saleId: string }) {
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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sales/${saleId}`)
      .then((r) => r.json())
      .then((d) => {
        setSale(d);
        if (d) {
          const round2 = (n: number) => Math.round(n * 100) / 100;
          setStatus(d.status ?? "DRAFT");
          setExwUsd(round2(d.exwUsd ?? 0));
          setCommissionPct(round2(d.commissionPct ?? 0));
          setCommissionAmountUsd(round2(d.commissionAmountUsd ?? 0));
          setFobUsd(round2(d.fobUsd ?? 0));
          setFreightUsd(round2(d.freightUsd ?? 0));
          setCifUsd(round2(d.cifUsd ?? 0));
          setTaxesFeesUsd(round2(d.taxesFeesUsd ?? 0));
          setLandedDdpUsd(round2(d.landedDdpUsd ?? 0));
          setNotes(d.notes ?? "");
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
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          exwUsd: Number(exwUsd.toFixed(2)),
          commissionPct: Number(commissionPct.toFixed(2)),
          commissionAmountUsd: Number(commissionAmountUsd.toFixed(2)),
          fobUsd: Number(fobUsd.toFixed(2)),
          freightUsd: Number(freightUsd.toFixed(2)),
          cifUsd: Number(cifUsd.toFixed(2)),
          taxesFeesUsd: Number(taxesFeesUsd.toFixed(2)),
          landedDdpUsd: Number(landedDdpUsd.toFixed(2)),
          notes: notes || undefined,
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

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;
  if (!sale) return <div className="py-8 text-center text-gray-500">Sale not found</div>;

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
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Financials (USD)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["EXW", exwUsd, setExwUsd, true],
              ["Commission %", commissionPct, setCommissionPct, false],
              ["Commission amount", commissionAmountUsd, setCommissionAmountUsd, true],
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

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
          {saving ? "Saving..." : "Save changes"}
        </button>
        <Link href={`/sales/${saleId}`} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
      </div>
    </form>
  );
}

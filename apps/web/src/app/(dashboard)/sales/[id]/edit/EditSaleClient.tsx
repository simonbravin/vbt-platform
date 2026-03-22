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

function validateFinancials(
  data: { exwUsd: number; fobUsd: number; cifUsd: number; landedDdpUsd: number },
  t: (key: string, vars?: Record<string, string | number>) => string
): string | null {
  if (data.exwUsd < 0 || data.fobUsd < 0 || data.cifUsd < 0 || data.landedDdpUsd < 0) return t("partner.sales.new.validation.nonNegative");
  if (data.landedDdpUsd < data.cifUsd) return t("partner.sales.new.validation.ddpGteCif");
  if (data.cifUsd < data.fobUsd) return t("partner.sales.new.validation.cifGteFob");
  if (data.fobUsd < data.exwUsd) return t("partner.sales.new.validation.fobGteExw");
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
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/sales/${saleId}`);
        const text = await r.text();
        let d: Record<string, unknown> | null = null;
        try {
          d = text ? JSON.parse(text) : null;
        } catch {
          d = null;
        }
        if (cancelled) return;
        if (!r.ok || !d || typeof d.id !== "string") {
          setSale(null);
          setEntities([]);
          setLoading(false);
          return;
        }
        setSale(d);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const st = String(d.status ?? "");
        setStatus(["PAID", "PARTIALLY_PAID", "DUE"].includes(st) ? "" : st || "DRAFT");
        setExwUsd(round2(Number(d.exwUsd ?? 0)));
        setCommissionPct(round2(Number(d.commissionPct ?? 0)));
        setCommissionAmountUsd(round2(Number(d.commissionAmountUsd ?? 0)));
        setFobUsd(round2(Number(d.fobUsd ?? 0)));
        setFreightUsd(round2(Number(d.freightUsd ?? 0)));
        setCifUsd(round2(Number(d.cifUsd ?? 0)));
        setTaxesFeesUsd(round2(Number(d.taxesFeesUsd ?? 0)));
        setLandedDdpUsd(round2(Number(d.landedDdpUsd ?? 0)));
        setInvoicedBasis(String(d.invoicedBasis || "DDP").toUpperCase() as "EXW" | "FOB" | "CIF" | "DDP");
        setNotes(typeof d.notes === "string" ? d.notes : "");
        const invList = Array.isArray(d.invoices) ? d.invoices : [];
        setInvoices(
          invList.map((inv: { entityId: string; amountUsd: number; dueDate: string | null; sequence?: number; referenceNumber?: string | null; notes?: string | null }) => ({
            entityId: inv.entityId,
            amountUsd: round2(inv.amountUsd ?? 0),
            dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "",
            sequence: inv.sequence ?? 1,
            referenceNumber: inv.referenceNumber ?? "",
            notes: inv.notes ?? "",
          }))
        );

        const orgQ =
          d.organizationId != null && String(d.organizationId).trim().length > 0
            ? `?organizationId=${encodeURIComponent(String(d.organizationId))}`
            : "";
        const er = await fetch(`/api/sales/entities${orgQ}`);
        const etext = await er.text();
        let list: Entity[] = [];
        if (er.ok) {
          try {
            const raw = etext ? JSON.parse(etext) : null;
            list = Array.isArray(raw) ? raw : [];
          } catch {
            list = [];
          }
        }
        if (!cancelled) setEntities(list);
      } catch {
        if (!cancelled) {
          setSale(null);
          setEntities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validateFinancials({ exwUsd, fobUsd, cifUsd, landedDdpUsd }, t);
    if (err) {
      setError(err);
      return;
    }
    const validInvoices = invoices.filter((inv) => !!inv.entityId);
    const invoicesSum = validInvoices.reduce((a, inv) => a + Number(inv.amountUsd), 0);
    const maxInvoiced = getMaxInvoiced(invoicedBasis, exwUsd, fobUsd, cifUsd, landedDdpUsd);
    if (validInvoices.length > 0 && invoicesSum > maxInvoiced) {
      setError(
        t("partner.sales.new.errorInvoiceCap", {
          sum: invoicesSum.toFixed(2),
          max: maxInvoiced.toFixed(2),
        })
      );
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
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t("partner.sales.failedToUpdate"));
      router.push(`/sales/${saleId}`);
    } catch (err: any) {
      setError(err.message ?? t("partner.sales.failedToSave"));
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
          <ArrowLeft className="w-4 h-4" /> {t("partner.sales.backToSale")}
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="surface-card p-6">
        <h2 className="font-semibold text-gray-800 mb-2">{t("partner.sales.edit.saleCardTitle")}</h2>
        <p className="text-sm text-gray-600">
          {sale.saleNumber} · {sale.client?.name} · {sale.project?.name}
          {sale.quote
            ? ` · ${t("partner.sales.detail.quote")}: ${sale.quote.quoteNumber ?? sale.quote.id}`
            : ""}
          {" · "}
          {t("partner.sales.detail.qty")}: {sale.quantity}
        </p>
      </div>

      <div className="surface-card p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">{t("partner.sales.colStatus")}</h2>
        {["PAID", "PARTIALLY_PAID", "DUE"].includes(sale.status) ? (
          <>
            <p className="text-sm text-gray-600">
              {t("partner.sales.edit.statusLabelPrefix")}{" "}
              <strong>{t(`partner.sales.status.${sale.status}`)}</strong>{" "}
              {t("partner.sales.edit.statusAutoSuffix")}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.edit.changeStatus")}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">{t("partner.sales.edit.keepStatus")}</option>
                <option value="CANCELLED">{t("partner.sales.edit.cancelSaleOption")}</option>
              </select>
            </div>
          </>
        ) : (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {statusOptions.map((s) => (
              <option key={s} value={s}>{t(`partner.sales.status.${s}`)}</option>
            ))}
          </select>
        )}
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.salesConditionLabel")}</label>
          <select value={invoicedBasis} onChange={(e) => setInvoicedBasis(e.target.value as "EXW" | "FOB" | "CIF" | "DDP")} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {INVOICED_BASIS_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="surface-card p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">{t("partner.sales.new.sectionFinancials")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["partner.sales.new.fin.exw", exwUsd, setExwUsd, true],
              ["partner.sales.new.fin.commissionPct", commissionPct, setCommissionPct, false],
              ["partner.sales.new.fin.commissionAmount", commissionAmountUsd, setCommissionAmountUsd, true],
              ["partner.sales.new.fin.fob", fobUsd, setFobUsd, true],
              ["partner.sales.new.fin.freight", freightUsd, setFreightUsd, true],
              ["partner.sales.new.fin.cif", cifUsd, setCifUsd, true],
              ["partner.sales.new.fin.taxesFees", taxesFeesUsd, setTaxesFeesUsd, true],
              ["partner.sales.new.fin.landedDdp", landedDdpUsd, setLandedDdpUsd, true],
            ] as [string, number, (n: number) => void, boolean][]
          ).map(([labelKey, val, setter, isCurrency]) => (
            <div key={labelKey}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t(labelKey)}</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.notes")}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
        </div>
      </div>

      <div className="surface-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("partner.sales.new.sectionInvoices")}</h2>
          <button
            type="button"
            onClick={() => setInvoices((prev) => [...prev, { entityId: "", amountUsd: 0, dueDate: "", sequence: prev.length + 1, referenceNumber: "", notes: "" }])}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-vbt-blue hover:bg-blue-50 rounded-lg"
          >
            <Plus className="w-4 h-4" /> {t("partner.sales.new.addLine")}
          </button>
        </div>
        <p className="text-xs text-gray-500">{t("partner.sales.edit.invoicesHint")}</p>
        {invoices.filter((i) => i.entityId).length > 0 && (() => {
          const sum = invoices.filter((i) => i.entityId).reduce((a, i) => a + Number(i.amountUsd), 0);
          const max = getMaxInvoiced(invoicedBasis, exwUsd, fobUsd, cifUsd, landedDdpUsd);
          return sum > max ? (
            <p className="text-sm text-amber-600">
              {t("partner.sales.new.invoiceSumExceeds", {
                sum: sum.toFixed(2),
                basis: invoicedBasis,
                max: max.toFixed(2),
              })}
            </p>
          ) : null;
        })()}
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-500">{t("partner.sales.new.noInvoiceLines")}</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv, idx) => (
              <li key={idx} className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">{t("partner.sales.new.entity")}</label>
                  <select
                    value={inv.entityId}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, entityId: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="">{t("partner.sales.new.selectEntity")}</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">{t("partner.sales.new.amountUsd")}</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">{t("partner.sales.new.dueDate")}</label>
                  <input
                    type="date"
                    value={inv.dueDate}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, dueDate: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">{t("partner.sales.new.seq")}</label>
                  <input
                    type="number"
                    min={1}
                    value={inv.sequence}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, sequence: parseInt(e.target.value, 10) || 1 } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="min-w-[120px] flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">{t("partner.sales.new.refNumber")}</label>
                  <input
                    type="text"
                    value={inv.referenceNumber}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, referenceNumber: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder={t("partner.sales.new.externalInvoicePlaceholder")}
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">{t("common.notes")}</label>
                  <input
                    type="text"
                    value={inv.notes}
                    onChange={(e) => setInvoices((prev) => prev.map((p, i) => (i === idx ? { ...p, notes: e.target.value } : p)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder={t("partner.sales.new.lineNotesPlaceholder")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setInvoices((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  title={t("partner.sales.new.removeLineTitle")}
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
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}

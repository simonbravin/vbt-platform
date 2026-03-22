"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { INVOICED_BASIS_OPTIONS } from "@/lib/sales";
import { saasQuoteRowToLegacySaleShape, type LegacySaleQuoteRow } from "@/lib/saas-quote-legacy-sale-shape";
import { useT } from "@/lib/i18n/context";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Client = { id: string; name: string };
type Project = { id: string; name: string; clientId: string | null };
type Quote = LegacySaleQuoteRow;
type Entity = { id: string; name: string; slug: string };

type InvoiceLine = { entityId: string; amountUsd: number; dueDate: string; sequence: number; referenceNumber: string; notes: string };

export type NewSaleClientProps = {
  /** Superadmin: target partner org. Omit for distributor session. */
  scopedOrganizationId?: string;
  backHref?: string;
  cancelHref?: string;
  successPath?: (saleId: string) => string;
};

export function NewSaleClient({
  scopedOrganizationId,
  backHref = "/sales",
  cancelHref = "/sales",
  successPath = (id) => `/sales/${id}`,
}: NewSaleClientProps = {}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"DRAFT" | "CONFIRMED">("DRAFT");
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const orgParam = scopedOrganizationId
      ? `&organizationId=${encodeURIComponent(scopedOrganizationId)}`
      : "";
    fetch(`/api/clients?limit=500${orgParam}`)
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []));
    fetch(`/api/saas/projects?limit=500${orgParam}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
    const entUrl = scopedOrganizationId
      ? `/api/sales/entities?organizationId=${encodeURIComponent(scopedOrganizationId)}`
      : "/api/sales/entities";
    fetch(entUrl)
      .then((r) => r.json())
      .then((d) => setEntities(Array.isArray(d) ? d : []));
  }, [scopedOrganizationId]);

  const qId = searchParams.get("quoteId");
  const pId = searchParams.get("projectId");
  const cId = searchParams.get("clientId");
  useEffect(() => {
    if (pId) setProjectId(pId);
    if (cId) setClientId(cId);
    if (qId) setQuoteId(qId);
  }, [qId, pId, cId]);

  const projectsForClient = clientId
    ? projects.filter((p) => p.clientId === clientId || !p.clientId)
    : projects;

  useEffect(() => {
    if (!projectId) {
      setQuotes([]);
      setQuoteId("");
      return;
    }
    fetch(
      `/api/saas/quotes?projectId=${projectId}&limit=50${
        scopedOrganizationId ? `&organizationId=${encodeURIComponent(scopedOrganizationId)}` : ""
      }`
    )
      .then((r) => r.json())
      .then((d) => {
        const raw = Array.isArray(d) ? d : d.quotes ?? [];
        const list = raw.map((row: Record<string, unknown>) => saasQuoteRowToLegacySaleShape(row));
        setQuotes(list);
        const fromUrl = searchParams.get("quoteId");
        if (fromUrl && list.some((x: { id: string }) => x.id === fromUrl)) setQuoteId(fromUrl);
        else if (!searchParams.get("quoteId")) setQuoteId("");
      })
      .catch(() => setQuotes([]));
  }, [projectId, searchParams, scopedOrganizationId]);

  useEffect(() => {
    if (!quoteId || quotes.length === 0) return;
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return;
    const mult = quantity;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    setExwUsd(round2(q.factoryCostUsd * mult));
    setCommissionPct(round2(q.commissionPct));
    setCommissionAmountUsd(round2((q.fobUsd - q.factoryCostUsd) * mult));
    setFobUsd(round2(q.fobUsd * mult));
    setFreightUsd(round2(q.freightCostUsd * mult));
    setCifUsd(round2(q.cifUsd * mult));
    setTaxesFeesUsd(round2(q.taxesFeesUsd * mult));
    setLandedDdpUsd(round2(q.landedDdpUsd * mult));
  }, [quoteId, quantity, quotes]);

  const validateFinancials = () => {
    if (exwUsd < 0 || fobUsd < 0 || cifUsd < 0 || landedDdpUsd < 0) return t("partner.sales.new.validation.nonNegative");
    if (landedDdpUsd < cifUsd) return t("partner.sales.new.validation.ddpGteCif");
    if (cifUsd < fobUsd) return t("partner.sales.new.validation.cifGteFob");
    if (fobUsd < exwUsd) return t("partner.sales.new.validation.fobGteExw");
    return null;
  };

  const getMaxInvoiced = () => {
    const b = (invoicedBasis || "DDP").toUpperCase();
    if (b === "EXW") return exwUsd;
    if (b === "FOB") return fobUsd;
    if (b === "CIF") return cifUsd;
    return landedDdpUsd;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId || !projectId) {
      setError(t("partner.sales.new.errorClientProjectRequired"));
      return;
    }
    const validationErr = validateFinancials();
    if (validationErr) {
      setError(validationErr);
      return;
    }
    const validInvoices = invoices.filter((inv) => inv.entityId && inv.amountUsd >= 0);
    const invoicesSum = validInvoices.reduce((a, inv) => a + Number(inv.amountUsd), 0);
    const maxInvoiced = getMaxInvoiced();
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
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectId,
          quoteId: quoteId || undefined,
          quantity,
          status,
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
          ...(scopedOrganizationId ? { organizationId: scopedOrganizationId } : {}),
          invoices: invoices
            .filter((inv) => inv.entityId && inv.amountUsd >= 0)
            .map((inv) => ({
              entityId: inv.entityId,
              amountUsd: Number(Number(inv.amountUsd).toFixed(2)),
              dueDate: inv.dueDate || undefined,
              sequence: inv.sequence || 1,
              referenceNumber: inv.referenceNumber?.trim() || undefined,
              notes: inv.notes || undefined,
            })),
        }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t("partner.sales.new.failedToCreate"));
      router.push(`/sales/${(data as { id: string }).id}`);
    } catch (err: any) {
      setError(err.message ?? t("partner.sales.new.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex gap-4">
        <Link href={backHref} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t("partner.sales.backToSales")}
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="surface-card p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">{t("partner.sales.new.sectionDetails")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.clientLabel")}</label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">{t("partner.sales.new.selectClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.projectLabel")}</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">{t("partner.sales.new.selectProject")}</option>
              {projectsForClient.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p as { projectName?: string; name?: string }).projectName ?? p.name ?? p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.quoteOptional")}</label>
            <select
              value={quoteId}
              onChange={(e) => setQuoteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">{t("partner.sales.new.quoteNoneManual")}</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>{q.quoteNumber ?? q.id.slice(0, 8)} – {formatCurrency(q.landedDdpUsd)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.quantity")}</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.colStatus")}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "DRAFT" | "CONFIRMED")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="DRAFT">{t("partner.sales.status.DRAFT")}</option>
              <option value="CONFIRMED">{t("partner.sales.status.CONFIRMED")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.salesConditionLabel")}</label>
            <select
              value={invoicedBasis}
              onChange={(e) => setInvoicedBasis(e.target.value as "EXW" | "FOB" | "CIF" | "DDP")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {INVOICED_BASIS_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-0.5">{t("partner.sales.new.salesConditionHelp")}</p>
          </div>
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={2}
          />
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
        <p className="text-xs text-gray-500">{t("partner.sales.new.invoicesHint")}</p>
        {invoices.filter((i) => i.entityId).length > 0 && (() => {
          const sum = invoices.filter((i) => i.entityId).reduce((a, i) => a + Number(i.amountUsd), 0);
          const max = getMaxInvoiced();
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
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("partner.sales.new.createSale")}
        </button>
        <Link href={cancelHref} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, parseJsonSafe } from "@/lib/utils";
import { getInvoicedAmount } from "@/lib/sales";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const DUE_SOON_DAYS = 7;

function getInvoiceDueStatus(dueDate: string | null): "overdue" | "due_soon" | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return "overdue";
  const limit = new Date(today);
  limit.setDate(limit.getDate() + DUE_SOON_DAYS);
  if (d <= limit) return "due_soon";
  return null;
}

type Sale = {
  id: string;
  organizationId?: string;
  saleNumber: string | null;
  clientId: string;
  projectId: string;
  quantity: number;
  status: string;
  invoicedBasis?: string | null;
  exwUsd: number;
  commissionPct: number;
  commissionAmountUsd: number;
  fobUsd: number;
  freightUsd: number;
  cifUsd: number;
  taxesFeesUsd: number;
  landedDdpUsd: number;
  notes: string | null;
  createdAt: string;
  client: { id: string; name: string; email: string | null };
  project: { id: string; name: string };
  quote: { id: string; quoteNumber: string | null } | null;
  invoices: { id: string; entityId: string; amountUsd: number; dueDate: string | null; sequence: number; referenceNumber: string | null; notes: string | null; entity: { name: string; slug: string } }[];
  payments: { id: string; entityId: string; amountUsd: number; amountLocal: number | null; currencyLocal: string | null; exchangeRate: number | null; paidAt: string; notes: string | null; entity: { name: string; slug: string } }[];
  invoiceStatusByEntity?: Record<string, { paid: number; invoiced: number; status: string }>;
};

export type SaleDetailClientProps = {
  saleId: string;
  backHref?: string;
  afterDeleteHref?: string;
  /** `undefined`: `/sales/[saleId]/edit`. `null`: hide edit. */
  editHref?: string | null;
  quoteLinkPrefix?: string;
};

export function SaleDetailClient({
  saleId,
  backHref = "/sales",
  afterDeleteHref = "/sales",
  editHref: editHrefProp,
  quoteLinkPrefix = "/quotes",
}: SaleDetailClientProps) {
  const t = useT();
  const resolvedEditHref = editHrefProp === undefined ? `/sales/${saleId}/edit` : editHrefProp;
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [entities, setEntities] = useState<{ id: string; name: string; isActive?: boolean }[]>([]);
  const [payEntityId, setPayEntityId] = useState("");
  const [payAmountUsd, setPayAmountUsd] = useState("");
  const [payAmountLocal, setPayAmountLocal] = useState("");
  const [payExchangeRate, setPayExchangeRate] = useState("");
  const [payPaidAt, setPayPaidAt] = useState(new Date().toISOString().slice(0, 16));
  const [payNotes, setPayNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [deletePaymentError, setDeletePaymentError] = useState<string | null>(null);
  const [deleteSaleOpen, setDeleteSaleOpen] = useState(false);
  const [deletingSale, setDeletingSale] = useState(false);
  const [deleteSaleError, setDeleteSaleError] = useState<string | null>(null);
  const [invoiceModalMode, setInvoiceModalMode] = useState<null | "add" | string>(null);
  const [invEntityId, setInvEntityId] = useState("");
  const [invAmountUsd, setInvAmountUsd] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [invSequence, setInvSequence] = useState(1);
  const [invReferenceNumber, setInvReferenceNumber] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [invSubmitting, setInvSubmitting] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState<string | null>(null);

  const router = useRouter();

  const refetchSale = () =>
    fetch(`/api/sales/${saleId}`)
      .then(async (r) => {
        try {
          const text = await r.text();
          const d = text ? JSON.parse(text) : null;
          if (d) setSale(d);
        } catch {
          // ignore
        }
      })
      .catch(() => {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/sales/${saleId}`);
        const text = await r.text();
        const d = text ? JSON.parse(text) : null;
        if (cancelled) return;
        if (!d?.id) {
          setSale(null);
          setEntities([]);
          setLoading(false);
          return;
        }
        setSale(d);
        const orgQ =
          d.organizationId != null && String(d.organizationId).length > 0
            ? `?organizationId=${encodeURIComponent(String(d.organizationId))}`
            : "";
        const er = await fetch(`/api/sales/entities${orgQ}`);
        const etext = await er.text();
        let list: unknown[] = [];
        if (er.ok) {
          let raw: unknown = null;
          try {
            raw = etext ? JSON.parse(etext) : null;
          } catch {
            raw = null;
          }
          list = Array.isArray(raw)
            ? raw
            : raw && typeof raw === "object" && "entities" in raw && Array.isArray((raw as { entities: unknown }).entities)
              ? (raw as { entities: unknown[] }).entities
              : [];
        }
        if (!cancelled) {
          setEntities(
            Array.isArray(list)
              ? (list as { id: string; name: string; isActive?: boolean }[]).filter(
                  (e) => e && typeof e.id === "string" && typeof e.name === "string"
                )
              : []
          );
        }
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

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    if (!payEntityId || !payAmountUsd || parseFloat(payAmountUsd) <= 0) {
      setPayError(t("partner.sales.payment.entityAmountRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: payEntityId,
          amountUsd: parseFloat(payAmountUsd),
          amountLocal: payAmountLocal ? parseFloat(payAmountLocal) : undefined,
          exchangeRate: payExchangeRate ? parseFloat(payExchangeRate) : undefined,
          paidAt: payPaidAt ? new Date(payPaidAt).toISOString() : undefined,
          notes: payNotes || undefined,
        }),
      });
      const data = parseJsonSafe<{ error?: string }>(await res.text());
      if (!res.ok) throw new Error(data.error ?? t("partner.sales.failedToAddPayment"));
      setPaymentOpen(false);
      setPayAmountUsd("");
      setPayAmountLocal("");
      setPayExchangeRate("");
      setPayNotes("");
      refetchSale();
    } catch (err: any) {
      setPayError(err.message ?? t("partner.sales.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  const openAddInvoice = () => {
    setInvEntityId("");
    setInvAmountUsd("");
    setInvDueDate("");
    setInvSequence((sale?.invoices?.length ?? 0) + 1);
    setInvReferenceNumber("");
    setInvNotes("");
    setInvError(null);
    setInvoiceModalMode("add");
  };

  const openEditInvoice = (inv: Sale["invoices"][0]) => {
    setInvEntityId(inv.entityId);
    setInvAmountUsd(String(inv.amountUsd));
    setInvDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "");
    setInvSequence(inv.sequence ?? 1);
    setInvReferenceNumber(inv.referenceNumber ?? "");
    setInvNotes(inv.notes ?? "");
    setInvError(null);
    setInvoiceModalMode(inv.id);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;
    setInvError(null);
    const amount = parseFloat(invAmountUsd);
    if (!invEntityId || isNaN(amount) || amount < 0) {
      setInvError(t("partner.sales.payment.entityAmountRequired"));
      return;
    }
    setInvSubmitting(true);
    try {
      const isEdit = invoiceModalMode && invoiceModalMode !== "add";
      const body = {
        entityId: invEntityId,
        amountUsd: amount,
        dueDate: invDueDate || null,
        sequence: invSequence,
        referenceNumber: invReferenceNumber.trim() || null,
        notes: invNotes.trim() || null,
      };
      if (isEdit) {
        const res = await fetch(`/api/sales/${saleId}/invoices/${invoiceModalMode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = parseJsonSafe<{ error?: string }>(await res.text());
        if (!res.ok) throw new Error(data.error ?? t("partner.sales.failedToUpdateInvoice"));
      } else {
        const res = await fetch(`/api/sales/${saleId}/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = parseJsonSafe<{ error?: string }>(await res.text());
        if (!res.ok) throw new Error(data.error ?? t("partner.sales.failedToAddInvoice"));
      }
      setInvoiceModalMode(null);
      refetchSale();
    } catch (err: unknown) {
      setInvError(err instanceof Error ? err.message : t("partner.sales.errorGeneric"));
    } finally {
      setInvSubmitting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceId) return;
    setDeletingInvoice(true);
    setDeleteInvoiceError(null);
    try {
      const res = await fetch(`/api/sales/${saleId}/invoices/${deleteInvoiceId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteInvoiceId(null);
        refetchSale();
      } else {
        const data = parseJsonSafe<{ error?: string }>(await res.text());
        setDeleteInvoiceError(data.error ?? t("partner.sales.failedToRemoveInvoice"));
      }
    } catch {
      setDeleteInvoiceError(t("partner.sales.failedToRemoveInvoice"));
    } finally {
      setDeletingInvoice(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    setDeletingPayment(true);
    setDeletePaymentError(null);
    try {
      const res = await fetch(`/api/sales/payments/${deletePaymentId}`, { method: "DELETE" });
      if (res.ok) {
        setDeletePaymentId(null);
        refetchSale();
      } else {
        const data = parseJsonSafe<{ error?: string }>(await res.text());
        setDeletePaymentError(data.error ?? t("partner.sales.failedToRemovePayment"));
      }
    } catch {
      setDeletePaymentError(t("partner.sales.failedToRemovePayment"));
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleDeleteSale = async () => {
    setDeletingSale(true);
    setDeleteSaleError(null);
    try {
      const res = await fetch(`/api/sales/${saleId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteSaleOpen(false);
        router.push(afterDeleteHref);
        return;
      }
      const data = parseJsonSafe<{ error?: string }>(await res.text());
      setDeleteSaleError(data.error ?? t("partner.sales.failedToDeleteSale"));
    } catch {
      setDeleteSaleError(t("partner.sales.failedToDeleteSale"));
    } finally {
      setDeletingSale(false);
    }
  };

  if (loading || !sale) {
    return (
      <div className="flex items-center justify-center py-12">
        {loading ? <p className="text-gray-500">{t("partner.sales.loading")}</p> : <p className="text-gray-500">{t("partner.sales.saleNotFound")}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Link href={backHref} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="w-4 h-4" /> {t("partner.sales.backToSales")}
          </Link>
          {resolvedEditHref && sale.status !== "CANCELLED" && sale.status !== "PAID" && (
            <Link href={resolvedEditHref} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Pencil className="w-4 h-4" /> {t("common.edit")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDeleteSaleOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> {t("partner.sales.deleteSale")}
          </button>
        </div>
        <span
          className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
            sale.status === "PAID" ? "bg-green-100 text-green-700" :
            sale.status === "DUE" ? "bg-amber-100 text-amber-800" :
            sale.status === "CANCELLED" ? "bg-gray-100 text-gray-600" :
            sale.status === "PARTIALLY_PAID" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
          }`}
        >
          {t(`partner.sales.status.${sale.status}`)}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-xl font-bold text-gray-900">{sale.saleNumber ?? sale.id}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {t("partner.sales.detail.client")}: <Link href={`/clients/${sale.clientId}`} className="text-vbt-blue hover:underline">{sale.client.name}</Link>
          {" · "}
          {t("partner.sales.detail.project")}: <Link href={`/projects/${sale.projectId}`} className="text-vbt-blue hover:underline">{sale.project.name}</Link>
          {sale.quote && (
            <>
              {" · "}
              {t("partner.sales.detail.quote")}:{" "}
              <Link href={`${quoteLinkPrefix}/${sale.quote.id}`} className="text-vbt-blue hover:underline">
                {sale.quote.quoteNumber ?? sale.quote.id}
              </Link>
            </>
          )}
          {" · "}
          {t("partner.sales.detail.qty")}: {sale.quantity}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">{t("partner.sales.detail.financialSummary")}</h2>
          <div className="space-y-2 text-sm">
            {[
              [t("partner.sales.new.fin.exw"), sale.exwUsd],
              [t("partner.sales.new.fin.commissionPct"), `${sale.commissionPct}%`],
              [t("partner.sales.new.fin.commissionAmount"), sale.commissionAmountUsd],
              [t("partner.sales.new.fin.fob"), sale.fobUsd, true],
              [t("partner.sales.new.fin.freight"), sale.freightUsd],
              [t("partner.sales.new.fin.cif"), sale.cifUsd, true],
              [t("partner.sales.new.fin.taxesFees"), sale.taxesFeesUsd],
              [t("partner.sales.new.fin.landedDdp"), sale.landedDdpUsd, true],
            ].map(([label, val, bold]) => (
              <div key={String(label)} className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
                <span className="text-gray-600">{label}</span>
                <span>{typeof val === "number" ? formatCurrency(val) : val}</span>
              </div>
            ))}
          </div>
          {sale.notes && <p className="mt-4 text-sm text-gray-500 border-t pt-2">{sale.notes}</p>}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">{t("partner.sales.new.sectionInvoices")}</h2>
              {sale.status !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={openAddInvoice}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-vbt-orange text-white rounded text-sm font-medium hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4" /> {t("partner.sales.new.addLine")}
                </button>
              )}
            </div>
            {sale.invoices.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("partner.sales.detail.noInvoices")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...sale.invoices].sort((a, b) => (a.sequence ?? 1) - (b.sequence ?? 1)).map((inv) => {
                  const dueStatus = getInvoiceDueStatus(inv.dueDate);
                  return (
                    <li key={inv.id} className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="font-medium">{inv.entity?.name ?? "—"}</span>
                        {" – "}
                        {formatCurrency(inv.amountUsd)}
                        {inv.dueDate && (
                          <span className="text-gray-500">
                            {" "}
                            {t("partner.sales.detail.invoiceDue", { date: new Date(inv.dueDate).toLocaleDateString() })}
                          </span>
                        )}
                        {inv.referenceNumber && (
                          <span className="text-gray-500 block text-xs">{t("partner.sales.detail.refShort", { ref: inv.referenceNumber })}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {dueStatus === "overdue" && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{t("partner.sales.detail.invoiceOverdue")}</span>
                        )}
                        {dueStatus === "due_soon" && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">{t("partner.sales.detail.invoiceDueSoon")}</span>
                        )}
                        {sale.invoiceStatusByEntity?.[inv.entityId] && (
                          <span className="text-xs text-gray-500">{sale.invoiceStatusByEntity[inv.entityId].status}</span>
                        )}
                        {sale.status !== "CANCELLED" && (
                          <>
                            <button type="button" onClick={() => openEditInvoice(inv)} className="p-1 text-gray-400 hover:text-vbt-blue rounded" title={t("common.edit")}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setDeleteInvoiceId(inv.id)} className="p-1 text-gray-400 hover:text-red-600 rounded" title={t("partner.sales.detail.removeInvoiceTitle")}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">{t("partner.sales.detail.payments")}</h2>
              {sale.status !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-vbt-orange text-white rounded text-sm font-medium hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4" /> {t("partner.sales.detail.addPayment")}
                </button>
              )}
            </div>
            {sale.payments.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("partner.sales.detail.noPayments")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex justify-between items-start gap-2">
                    <span>
                      {p.entity.name} – {formatCurrency(p.amountUsd)}
                      {p.paidAt && t("partner.sales.detail.paidOnPrefix", { date: new Date(p.paidAt).toLocaleDateString() })}
                      {p.exchangeRate != null && p.amountLocal != null && (
                        <span className="text-gray-500 block text-xs">
                          {t("partner.sales.detail.amountLocalLine", {
                            amount: String(p.amountLocal),
                            currency: p.currencyLocal ?? t("partner.sales.detail.currencyLocalFallback"),
                            rate: String(p.exchangeRate),
                          })}
                        </span>
                      )}
                    </span>
                    {sale.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => setDeletePaymentId(p.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title={t("partner.sales.detail.removePaymentTitle")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {paymentOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.target === e.currentTarget && setPaymentOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">{t("partner.sales.detail.addPaymentTitle")}</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              {payError && <p className="text-sm text-red-600">{payError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.entityRequired")}</label>
                <select
                  value={payEntityId}
                  onChange={(e) => setPayEntityId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                >
                  <option value="">{t("partner.sales.new.selectEntity")}</option>
                  {entities.filter((e) => e.isActive !== false).length === 0 ? (
                    <option value="" disabled>{t("partner.sales.payment.noEntitiesHint")}</option>
                  ) : (
                    entities
                      .filter((e) => e.isActive !== false)
                      .map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.amountUsdRequired")}</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payAmountUsd}
                  onChange={(e) => setPayAmountUsd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.amountLocalLabel")}</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmountLocal}
                  onChange={(e) => setPayAmountLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={t("partner.sales.payment.amountLocalPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.exchangeRateLabel")}</label>
                <input
                  type="number"
                  step="0.01"
                  value={payExchangeRate}
                  onChange={(e) => setPayExchangeRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={t("partner.sales.payment.exchangeRatePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.dateLabel")}</label>
                <input
                  type="datetime-local"
                  value={payPaidAt}
                  onChange={(e) => setPayPaidAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.notes")}</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {submitting ? t("common.saving") : t("common.save")}
                </button>
                <button type="button" onClick={() => { setPaymentOpen(false); setPayError(null); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium">
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={!!deletePaymentId}
        onOpenChange={(open) => !open && (setDeletePaymentId(null), setDeletePaymentError(null))}
        title={t("partner.sales.removePaymentConfirmTitle")}
        description={t("partner.sales.removePaymentConfirmMessage")}
        confirmLabel={t("partner.sales.removePayment")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("partner.sales.removing")}
        variant="danger"
        loading={deletingPayment}
        error={deletePaymentError}
        onConfirm={handleDeletePayment}
      />

      <ConfirmDialog
        open={deleteSaleOpen}
        onOpenChange={(open) => !open && (setDeleteSaleOpen(false), setDeleteSaleError(null))}
        title={t("partner.sales.deleteSaleConfirmTitle")}
        description={sale ? t("partner.sales.deleteSaleConfirmMessage", { number: sale.saleNumber ?? saleId }) : ""}
        confirmLabel={t("partner.sales.deleteSale")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("common.deleting")}
        variant="danger"
        loading={deletingSale}
        error={deleteSaleError}
        onConfirm={handleDeleteSale}
      />

      {invoiceModalMode && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.target === e.currentTarget && !invSubmitting && setInvoiceModalMode(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">
              {invoiceModalMode === "add" ? t("partner.sales.detail.invoiceModalAdd") : t("partner.sales.detail.invoiceModalEdit")}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {sale &&
                t("partner.sales.detail.invoiceModalCapHint", {
                  amount: formatCurrency(getInvoicedAmount(sale)),
                  basis: sale?.invoicedBasis ?? "DDP",
                })}
            </p>
            <form onSubmit={handleSaveInvoice} className="space-y-4">
              {invError && <p className="text-sm text-red-600">{invError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.entityRequired")}</label>
                <select value={invEntityId} onChange={(e) => setInvEntityId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required>
                  <option value="">{t("partner.sales.new.selectEntity")}</option>
                  {entities.filter((e) => e.isActive !== false).map((ent) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.payment.amountUsdRequired")}</label>
                <input type="number" min="0" step="0.01" value={invAmountUsd} onChange={(e) => setInvAmountUsd(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.new.dueDate")}</label>
                <input type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.detail.sequenceLabel")}</label>
                <input type="number" min={1} value={invSequence} onChange={(e) => setInvSequence(parseInt(e.target.value, 10) || 1)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("partner.sales.detail.referenceNumber")}</label>
                <input type="text" value={invReferenceNumber} onChange={(e) => setInvReferenceNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t("partner.sales.new.externalInvoicePlaceholder")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.notes")}</label>
                <input type="text" value={invNotes} onChange={(e) => setInvNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={invSubmitting} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {invSubmitting ? t("common.saving") : t("common.save")}
                </button>
                <button type="button" onClick={() => { setInvoiceModalMode(null); setInvError(null); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium">
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={!!deleteInvoiceId}
        onOpenChange={(open) => !open && (setDeleteInvoiceId(null), setDeleteInvoiceError(null))}
        title={t("partner.sales.removeInvoiceConfirmTitle")}
        description={t("partner.sales.removeInvoiceConfirmMessage")}
        confirmLabel={t("partner.sales.removeLine")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("partner.sales.removing")}
        variant="danger"
        loading={deletingInvoice}
        error={deleteInvoiceError}
        onConfirm={handleDeleteInvoice}
      />
    </div>
  );
}

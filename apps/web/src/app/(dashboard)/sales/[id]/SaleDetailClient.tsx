"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

type Sale = {
  id: string;
  saleNumber: string | null;
  clientId: string;
  projectId: string;
  quantity: number;
  status: string;
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
  invoices: { id: string; entityId: string; amountUsd: number; dueDate: string | null; sequence: number; entity: { name: string; slug: string } }[];
  payments: { id: string; entityId: string; amountUsd: number; amountLocal: number | null; currencyLocal: string | null; exchangeRate: number | null; paidAt: string; notes: string | null; entity: { name: string; slug: string } }[];
  invoiceStatusByEntity?: Record<string, { paid: number; invoiced: number; status: string }>;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PARTIALLY_PAID: "Partial",
  PAID: "Paid",
  DUE: "Due",
  CANCELLED: "Cancelled",
};

export function SaleDetailClient({ saleId }: { saleId: string }) {
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

  const router = useRouter();

  useEffect(() => {
    fetch(`/api/sales/${saleId}`)
      .then((r) => r.json())
      .then((d) => { setSale(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/sales/entities")
      .then((r) => r.json())
      .then((d) => setEntities(Array.isArray(d) ? d : (d?.entities && Array.isArray(d.entities) ? d.entities : [])))
      .catch(() => setEntities([]));
  }, [saleId]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    if (!payEntityId || !payAmountUsd || parseFloat(payAmountUsd) <= 0) {
      setPayError("Entity and amount (USD) are required");
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
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to add payment");
      setPaymentOpen(false);
      setPayAmountUsd("");
      setPayAmountLocal("");
      setPayExchangeRate("");
      setPayNotes("");
      fetch(`/api/sales/${saleId}`).then((r) => r.json()).then(setSale);
    } catch (err: any) {
      setPayError(err.message ?? "Failed");
    } finally {
      setSubmitting(false);
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
        const d = await fetch(`/api/sales/${saleId}`).then((r) => r.json());
        setSale(d);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeletePaymentError(data.error ?? "Failed to remove payment");
      }
    } catch {
      setDeletePaymentError("Failed to remove payment");
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
        router.push("/sales");
        return;
      }
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      setDeleteSaleError((data as { error?: string }).error ?? "Failed to delete sale");
    } catch {
      setDeleteSaleError("Failed to delete sale");
    } finally {
      setDeletingSale(false);
    }
  };

  if (loading || !sale) {
    return (
      <div className="flex items-center justify-center py-12">
        {loading ? <p className="text-gray-500">Loading...</p> : <p className="text-gray-500">Sale not found</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Link href="/sales" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Sales
          </Link>
          {sale.status !== "CANCELLED" && sale.status !== "PAID" && (
            <Link href={`/sales/${saleId}/edit`} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Pencil className="w-4 h-4" /> Edit
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDeleteSaleOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> Delete sale
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
          {statusLabel[sale.status] ?? sale.status}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-xl font-bold text-gray-900">{sale.saleNumber ?? sale.id}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Client: <Link href={`/clients/${sale.clientId}`} className="text-vbt-blue hover:underline">{sale.client.name}</Link>
          {" · "}
          Project: <Link href={`/projects/${sale.projectId}`} className="text-vbt-blue hover:underline">{sale.project.name}</Link>
          {sale.quote && (
            <> · Quote: <Link href={`/quotes/${sale.quote.id}`} className="text-vbt-blue hover:underline">{sale.quote.quoteNumber ?? sale.quote.id}</Link></>
          )}
          {" · Qty: "}{sale.quantity}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Financial summary</h2>
          <div className="space-y-2 text-sm">
            {[
              ["EXW", sale.exwUsd],
              ["Commission %", `${sale.commissionPct}%`],
              ["Commission amount", sale.commissionAmountUsd],
              ["FOB", sale.fobUsd, true],
              ["Freight", sale.freightUsd],
              ["CIF", sale.cifUsd, true],
              ["Taxes & fees", sale.taxesFeesUsd],
              ["Landed DDP", sale.landedDdpUsd, true],
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
            <h2 className="font-semibold text-gray-800 mb-3">Invoices / due dates</h2>
            {sale.invoices.length === 0 ? (
              <p className="text-gray-500 text-sm">No invoices defined</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sale.invoices.map((inv) => (
                  <li key={inv.id} className="flex justify-between items-center">
                    <span>{inv.entity.name} – {formatCurrency(inv.amountUsd)}{inv.dueDate ? ` due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}</span>
                    {sale.invoiceStatusByEntity?.[inv.entityId] && (
                      <span className="text-xs text-gray-500">{sale.invoiceStatusByEntity[inv.entityId].status}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Payments</h2>
              {sale.status !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-vbt-orange text-white rounded text-sm font-medium hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4" /> Add payment
                </button>
              )}
            </div>
            {sale.payments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments recorded</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex justify-between items-start gap-2">
                    <span>
                      {p.entity.name} – {formatCurrency(p.amountUsd)}
                      {p.paidAt && ` on ${new Date(p.paidAt).toLocaleDateString()}`}
                      {p.exchangeRate != null && p.amountLocal != null && (
                        <span className="text-gray-500 block text-xs">
                          {p.amountLocal} {p.currencyLocal ?? "local"} @ {p.exchangeRate}
                        </span>
                      )}
                    </span>
                    {sale.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => setDeletePaymentId(p.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Remove payment"
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
            <h3 className="font-semibold text-gray-800 mb-4">Add payment</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              {payError && <p className="text-sm text-red-600">{payError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity *</label>
                <select
                  value={payEntityId}
                  onChange={(e) => setPayEntityId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                >
                  <option value="">Select entity</option>
                  {entities.filter((e) => e.isActive !== false).length === 0 ? (
                    <option value="" disabled>No entities—add in Admin → Entities</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD) *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (local currency)</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmountLocal}
                  onChange={(e) => setPayAmountLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. 9425000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exchange rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={payExchangeRate}
                  onChange={(e) => setPayExchangeRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. 1450"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="datetime-local"
                  value={payPaidAt}
                  onChange={(e) => setPayPaidAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {submitting ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => { setPaymentOpen(false); setPayError(null); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deletePaymentId && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.target === e.currentTarget && !deletingPayment && setDeletePaymentId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-2">Remove payment?</h3>
            <p className="text-sm text-gray-600 mb-4">This will delete the payment and update the sale status. This cannot be undone.</p>
            {deletePaymentError && <p className="text-sm text-red-600 mb-3">{deletePaymentError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDeletePaymentId(null); setDeletePaymentError(null); }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={deletingPayment}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingPayment ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteSaleOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.target === e.currentTarget && !deletingSale && setDeleteSaleOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-2">Delete sale?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete this sale ({sale.saleNumber ?? saleId}) and all its invoices and payments. This cannot be undone.
            </p>
            {deleteSaleError && <p className="text-sm text-red-600 mb-3">{deleteSaleError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDeleteSaleOpen(false); setDeleteSaleError(null); }}
                disabled={deletingSale}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSale}
                disabled={deletingSale}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingSale ? "Deleting..." : "Delete sale"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getInvoicedAmount } from "@/lib/sales";
import { ArrowLeft, Download, FileText, Mail } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Statement = {
  client: { id: string; name: string };
  sales: any[];
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
};
type Entity = { id: string; name: string; slug: string };

export function StatementsClient() {
  const t = useT();
  const [data, setData] = useState<{ statements: Statement[]; entities: Entity[]; filters: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (entityId) params.set("entityId", entityId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/sales/statements?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId, entityId, from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/clients?limit=500").then((r) => r.json()).then((d) => setClients(d.clients ?? []));
  }, []);

  const exportParams = () => {
    const p = new URLSearchParams();
    if (clientId) p.set("clientId", clientId);
    if (entityId) p.set("entityId", entityId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  };

  const handleExportCsv = () => {
    const params = exportParams();
    params.set("format", "csv");
    window.open(`/api/sales/statements/export?${params}`, "_blank");
  };

  const handleExportPdf = () => {
    const params = exportParams();
    params.set("format", "pdf");
    window.open(`/api/sales/statements/export?${params}`, "_blank");
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/sales/statements/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          message: emailMessage.trim() || undefined,
          clientId: clientId || undefined,
          entityId: entityId || undefined,
          dateFrom: from || undefined,
          dateTo: to || undefined,
        }),
      });
      const text = await res.text();
      let data: { ok?: boolean; message?: string; error?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
      if (res.ok && data.ok) {
        setEmailResult({ type: "success", text: data.message ?? `Sent to ${emailTo}` });
        setEmailTo("");
        setEmailMessage("");
      } else {
        setEmailResult({ type: "error", text: data.error ?? t("partner.sales.failedToSendEmail") });
      }
    } catch {
      setEmailResult({ type: "error", text: t("partner.sales.failedToSendEmail") });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/sales" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Sales
      </Link>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm min-w-[160px]">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm min-w-[160px]">
          <option value="">All entities</option>
          {data?.entities?.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
        <button type="button" onClick={fetchData} className="px-3 py-1.5 bg-vbt-blue text-white rounded-lg text-sm font-medium">
          Apply
        </button>
        <button type="button" onClick={handleExportCsv} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button type="button" onClick={handleExportPdf} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
          <FileText className="w-4 h-4" /> Export PDF
        </button>
        <button type="button" onClick={() => { setEmailOpen(true); setEmailResult(null); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Mail className="w-4 h-4" /> Send by email
        </button>
      </div>

      {emailOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => !emailSending && setEmailOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3">Send statements by email</h3>
            <p className="text-sm text-gray-500 mb-3">Current filters (client, entity, date range) will be applied. The PDF will be attached.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (email)</label>
                <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@company.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                <textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} rows={2} placeholder="Add a short message..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
              {emailResult && <p className={`text-sm ${emailResult.type === "success" ? "text-green-600" : "text-red-600"}`}>{emailResult.text}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => !emailSending && setEmailOpen(false)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleSendEmail} disabled={emailSending || !emailTo.trim()} className="px-3 py-1.5 bg-vbt-blue text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {emailSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">{t("partner.sales.loading")}</div>
        ) : !data?.statements?.length ? (
          <div className="p-8 text-center text-gray-500">{t("partner.sales.noDataForFilters")}</div>
        ) : (
          <div className="p-4 space-y-6">
            {data.statements.map((st) => (
              <div key={st.client.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-semibold text-gray-900">{st.client.name}</h2>
                  <div className="text-sm">
                    <span className="text-gray-500">Invoiced: </span>
                    <span className="font-medium">{formatCurrency(st.totalInvoiced)}</span>
                    <span className="text-gray-500 ml-3">Paid: </span>
                    <span className="font-medium">{formatCurrency(st.totalPaid)}</span>
                    <span className="text-gray-500 ml-3">Balance: </span>
                    <span className={`font-medium ${st.balance > 0 ? "text-amber-600" : "text-gray-900"}`}>{formatCurrency(st.balance)}</span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 pr-4">Sale #</th>
                      <th className="pb-2 pr-4">Project</th>
                      <th className="pb-2 pr-4 text-right">Invoiced</th>
                      <th className="pb-2 pr-4 text-right">Paid</th>
                      <th className="pb-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.sales.map((sale: any) => {
                      const invTotal = getInvoicedAmount(sale);
                      const payTotal = sale.payments?.reduce((a: number, p: any) => a + (p.amountUsd ?? 0), 0) ?? 0;
                      return (
                        <tr key={sale.id} className="border-b border-gray-50">
                          <td className="py-2 pr-4">
                            <Link href={`/sales/${sale.id}`} className="text-vbt-blue hover:underline">
                              {sale.saleNumber ?? sale.id?.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{sale.project?.name ?? ""}</td>
                          <td className="py-2 pr-4 text-right text-gray-700">{formatCurrency(invTotal)}</td>
                          <td className="py-2 pr-4 text-right text-gray-700">{formatCurrency(payTotal)}</td>
                          <td className="py-2 text-right font-medium">{formatCurrency(invTotal - payTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

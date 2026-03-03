"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Mail, Archive, ExternalLink } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/quotes/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setQuote(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

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
    } else {
      setSendResult(data.error ?? "Failed to send email");
    }
  };

  const archive = async () => {
    if (!confirm("Archive this quote?")) return;
    await fetch(`/api/quotes/${params.id}`, { method: "DELETE" });
    router.push("/quotes");
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
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> PDF
          </a>
          <button
            onClick={() => setEmailDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-vbt-blue text-white rounded-lg text-sm hover:bg-blue-900"
          >
            <Mail className="w-4 h-4" /> Send Email
          </button>
          <button
            onClick={archive}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
          >
            <Archive className="w-4 h-4" />
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
          { label: "S80 Wall Area", value: `${quote.wallAreaM2S80.toFixed(1)} m²` },
          { label: "S150 Wall Area", value: `${quote.wallAreaM2S150.toFixed(1)} m²` },
          { label: "S200 Wall Area", value: `${quote.wallAreaM2S200.toFixed(1)} m²` },
          { label: "Total Wall Area", value: `${quote.wallAreaM2Total.toFixed(1)} m²` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 uppercase">{s.label}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* CSV Lines */}
      {quote.lines?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Material Lines ({quote.lines.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Description", "System", "Qty", "Lin.m", "m²", "Unit Price", "Total"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.lines.map((line: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 text-gray-800">{line.description}</td>
                    <td className="px-3 py-2 text-gray-500">{line.systemCode ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{line.qty}</td>
                    <td className="px-3 py-2 text-right">{(line.linearM ?? 0).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{(line.m2Line ?? 0).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{fmt(line.unitPrice ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Cost Breakdown</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: `Factory Cost (${quote.costMethod})`, value: quote.factoryCostUsd },
              { label: `Commission (${quote.commissionPct}% + ${fmt(quote.commissionFixed)})`, value: snapshot.commissionAmount ?? 0 },
              { label: "FOB", value: quote.fobUsd, bold: true },
              { label: `Freight (${quote.numContainers} containers)`, value: quote.freightCostUsd },
              { label: "CIF", value: quote.cifUsd, bold: true },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between ${row.bold ? "font-semibold border-t pt-2" : ""}`}>
                <span className={row.bold ? "" : "text-gray-500"}>{row.label}</span>
                <span>{fmt(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tax Lines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Taxes & Fees {quote.country && `(${quote.country.name})`}</h2>
          {quote.taxLines?.length > 0 ? (
            <div className="space-y-2 text-sm">
              {quote.taxLines.map((tl: any) => (
                <div key={tl.id} className="flex justify-between">
                  <span className="text-gray-500">{tl.label}</span>
                  <span className="font-medium">{fmt(tl.computedAmount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total Taxes</span>
                <span>{fmt(quote.taxesFeesUsd)}</span>
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
            {quote.totalKits > 0 && (
              <p className="text-white/50 text-sm mt-1">
                {quote.totalKits} kits · {quote.numContainers} containers ·{" "}
                {fmt(quote.landedDdpUsd / Math.max(quote.numContainers, 1))}/container
              </p>
            )}
          </div>
          <p className="text-4xl font-bold text-white">{fmt(quote.landedDdpUsd)}</p>
        </div>
      </div>

      {/* Informational */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Informational (not in cost)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-400 text-xs">Concrete</p><p className="font-semibold">{quote.concreteM3.toFixed(1)} m³</p></div>
          <div><p className="text-gray-400 text-xs">Steel Est.</p><p className="font-semibold">{quote.steelKgEst.toFixed(0)} kg</p></div>
          <div><p className="text-gray-400 text-xs">Panel Weight</p><p className="font-semibold">{quote.totalWeightKg.toFixed(0)} kg</p></div>
          <div><p className="text-gray-400 text-xs">Panel Volume</p><p className="font-semibold">{quote.totalVolumeM3.toFixed(2)} m³</p></div>
        </div>
      </div>

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

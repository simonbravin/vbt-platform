"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type Client = { id: string; name: string };
type Project = { id: string; name: string; clientId: string | null };
type Quote = { id: string; quoteNumber: string | null; factoryCostUsd: number; commissionPct: number; commissionFixed: number; fobUsd: number; freightCostUsd: number; cifUsd: number; taxesFeesUsd: number; landedDdpUsd: number };
type Entity = { id: string; name: string; slug: string };

export function NewSaleClient() {
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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients?limit=500").then((r) => r.json()).then((d) => setClients(d.clients ?? []));
    fetch("/api/projects?limit=500").then((r) => r.json()).then((d) => setProjects(d.projects ?? []));
    fetch("/api/sales/entities").then((r) => r.json()).then((d) => setEntities(Array.isArray(d) ? d : []));
  }, []);

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
    fetch(`/api/quotes?projectId=${projectId}&limit=50`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.quotes ?? [];
        setQuotes(list);
        const fromUrl = searchParams.get("quoteId");
        if (fromUrl && list.some((x: { id: string }) => x.id === fromUrl)) setQuoteId(fromUrl);
        else if (!searchParams.get("quoteId")) setQuoteId("");
      })
      .catch(() => setQuotes([]));
  }, [projectId, searchParams]);

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
    if (exwUsd < 0 || fobUsd < 0 || cifUsd < 0 || landedDdpUsd < 0) return "Amounts cannot be negative.";
    if (landedDdpUsd < cifUsd) return "Landed DDP must be ≥ CIF.";
    if (cifUsd < fobUsd) return "CIF must be ≥ FOB.";
    if (fobUsd < exwUsd) return "FOB must be ≥ EXW.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId || !projectId) {
      setError("Client and Project are required");
      return;
    }
    const validationErr = validateFinancials();
    if (validationErr) {
      setError(validationErr);
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
          notes: notes || undefined,
          invoices: [],
        }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error al crear la venta");
      router.push(`/sales/${(data as { id: string }).id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex gap-4">
        <Link href="/sales" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Sales
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Sale details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Select project</option>
              {projectsForClient.map((p) => (
                <option key={p.id} value={p.id}>{(p as any).name ?? p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quote (optional)</label>
            <select
              value={quoteId}
              onChange={(e) => setQuoteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">None – enter values manually</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>{q.quoteNumber ?? q.id.slice(0, 8)} – {formatCurrency(q.landedDdpUsd)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "DRAFT" | "CONFIRMED")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
            </select>
          </div>
        </div>
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
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <span className="inline-flex items-center pl-3 bg-gray-100 text-gray-600 text-sm border-r border-gray-300">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={typeof val === "number" ? Number(val.toFixed(2)) : ""}
                    onChange={(e) => (setter as (n: number) => void)(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                    className="flex-1 min-w-0 px-3 py-2 border-0 rounded-none text-sm"
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={2}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Create sale"}
        </button>
        <Link href="/sales" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
      </div>
    </form>
  );
}

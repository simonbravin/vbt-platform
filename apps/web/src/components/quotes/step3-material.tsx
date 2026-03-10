"use client";

import { useState, useEffect } from "react";
import type { QuoteWizardState } from "@/app/(dashboard)/quotes/new/page";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step3MaterialCost({ state, update }: Props) {
  const [settings, setSettings] = useState<any>(null);
  const [importData, setImportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [usingM2Fallback, setUsingM2Fallback] = useState(false);

  // Load org settings (rates)
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  // Load CSV import data → extract m2 areas
  useEffect(() => {
    if (state.costMethod !== "CSV" || !state.revitImportId) return;
    setLoading(true);
    fetch(`/api/import/${state.revitImportId}`)
      .then((r) => r.json())
      .then((data) => {
        setImportData(data);
        let s80 = 0, s150 = 0, s200 = 0;
        for (const line of data.lines ?? []) {
          if (!line.isIgnored && line.m2Line) {
            const sys = line.piece?.systemCode;
            if (sys === "S80") s80 += line.m2Line;
            else if (sys === "S150") s150 += line.m2Line;
            else if (sys === "S200") s200 += line.m2Line;
          }
        }
        update({ m2S80: +s80.toFixed(2), m2S150: +s150.toFixed(2), m2S200: +s200.toFixed(2) });
      })
      .finally(() => setLoading(false));
  }, [state.revitImportId, state.costMethod]);

  // CSV always represents one kit (e.g. one house, one school unit). factoryCostUsd = cost per kit.
  // If piece prices are configured → use linearM × pricePerM (exact). If not → M² system rates.
  useEffect(() => {
    if (state.costMethod !== "CSV" || !importData || !settings) return;

    const lines: any[] = importData.lines ?? [];

    // Re-derive m2 areas directly from local importData to avoid stale state
    let s80 = 0, s150 = 0, s200 = 0;
    for (const line of lines) {
      if (!line.isIgnored && line.m2Line) {
        const sys = line.piece?.systemCode;
        if (sys === "S80") s80 += line.m2Line;
        else if (sys === "S150") s150 += line.m2Line;
        else if (sys === "S200") s200 += line.m2Line;
      }
    }

    const csvCost = lines.reduce((acc: number, l: any) => {
      if (!l.isIgnored && l.pricePerM) return acc + (l.linearM ?? 0) * l.pricePerM;
      return acc;
    }, 0);

    if (csvCost > 0) {
      setUsingM2Fallback(false);
      update({ factoryCostUsd: csvCost });
    } else {
      // Fallback: estimate from M² system rates
      const fallback =
        s80 * (settings.rateS80 ?? 37) +
        s150 * (settings.rateS150 ?? 67) +
        s200 * (settings.rateS200 ?? 85);
      setUsingM2Fallback(fallback > 0);
      update({ factoryCostUsd: fallback });
    }
  }, [importData, settings, state.costMethod]);

  // Sync factoryCostUsd for M2_BY_SYSTEM whenever inputs or settings change
  useEffect(() => {
    if (state.costMethod !== "M2_BY_SYSTEM" || !settings) return;
    const cost =
      state.m2S80 * (settings.rateS80 ?? 37) +
      state.m2S150 * (settings.rateS150 ?? 67) +
      state.m2S200 * (settings.rateS200 ?? 85);
    update({ factoryCostUsd: cost });
  }, [state.m2S80, state.m2S150, state.m2S200, settings, state.costMethod]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Step 3: Material Cost</h2>
        <p className="text-sm text-gray-500 mt-1">
          {state.costMethod === "CSV"
            ? "Review computed wall areas from your CSV import."
            : "Enter wall area per system and review rates."}
        </p>
      </div>

      {/* ── CSV Summary ────────────────────────────────────────────────────── */}
      {state.costMethod === "CSV" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading import data...</p>
          ) : importData ? (
            <>
              {/* Wall area KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "VBT 80mm",  value: state.m2S80,  color: "blue"   },
                  { label: "VBT 150mm", value: state.m2S150, color: "purple" },
                  { label: "VBT 200mm", value: state.m2S200, color: "green"  },
                  { label: "Total",     value: state.m2S80 + state.m2S150 + state.m2S200, color: "orange" },
                ].map((s) => (
                  <div key={s.label} className={`p-4 bg-${s.color}-50 rounded-lg border border-${s.color}-100`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label} Wall Area</p>
                    <p className={`text-xl font-bold text-${s.color}-700 mt-1`}>{s.value.toFixed(1)} m²</p>
                  </div>
                ))}
              </div>

              {/* Weight / Volume */}
              {(() => {
                let totalWeight = 0, totalVolume = 0;
                for (const line of importData.lines ?? []) {
                  if (!line.isIgnored) {
                    totalWeight += line.weightKgCored ?? 0;
                    totalVolume += line.volumeM3 ?? 0;
                  }
                }
                if (totalWeight === 0 && totalVolume === 0) return null;
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Total Panel Weight (cored)</p>
                      <p className="text-lg font-semibold mt-1">{totalWeight.toFixed(1)} kg</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Total Panel Volume</p>
                      <p className="text-lg font-semibold mt-1">{totalVolume.toFixed(2)} m³</p>
                    </div>
                  </div>
                );
              })()}

              {/* Factory cost (EXW) */}
              {usingM2Fallback && settings ? (
                // No piece prices → show M² rate breakdown as fallback
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 font-medium text-sm">
                      Piece prices not configured — using M² system rates as estimate
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">
                      Set prices in the Piece Catalog to get an exact per-piece cost.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: "VBT 80mm",  m2: state.m2S80,  rate: settings.rateS80  ?? 37 },
                      { label: "VBT 150mm", m2: state.m2S150, rate: settings.rateS150 ?? 67 },
                      { label: "VBT 200mm", m2: state.m2S200, rate: settings.rateS200 ?? 85 },
                    ].filter(s => s.m2 > 0).map((s) => (
                      <div key={s.label} className="p-3 bg-white border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className="text-sm font-medium mt-0.5">
                          {s.m2.toFixed(1)} m² × {fmt(s.rate)}/m²
                        </p>
                        <p className="text-base font-bold text-gray-800 mt-0.5">= {fmt(s.m2 * s.rate)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                    <p className="text-blue-800 font-medium">Estimated Factory cost (EXW)</p>
                    <p className="text-2xl font-bold text-blue-700">{fmt(state.factoryCostUsd ?? 0)}</p>
                  </div>
                </div>
              ) : (state.factoryCostUsd ?? 0) > 0 ? (
                <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between">
                  <p className="text-green-800 font-medium">Factory cost (EXW) – CSV piece prices</p>
                  <p className="text-2xl font-bold text-green-700">{fmt(state.factoryCostUsd ?? 0)}</p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 font-medium text-sm">⚠ No piece costs or M² rates available</p>
                  <p className="text-amber-600 text-xs mt-1">
                    Configure piece prices in the Catalog or system rates in Admin settings.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-red-500 text-sm">Could not load import data.</p>
          )}
        </div>
      )}

      {/* ── M2 by System ───────────────────────────────────────────────────── */}
      {state.costMethod === "M2_BY_SYSTEM" && settings && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: "m2S80"  as const, label: "VBT 80mm",  rate: settings.rateS80  },
              { key: "m2S150" as const, label: "VBT 150mm", rate: settings.rateS150 },
              { key: "m2S200" as const, label: "VBT 200mm", rate: settings.rateS200 },
            ].map((sys) => (
              <div key={sys.key} className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {sys.label} Wall Area (m²)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={state[sys.key]}
                  onChange={(e) => update({ [sys.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
                <p className="text-xs text-gray-400 mt-1">Rate: {fmt(sys.rate)}/m²</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">
                  = {fmt(state[sys.key] * sys.rate)}
                </p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <p className="text-blue-800 font-medium">Total Factory cost (EXW)</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(state.factoryCostUsd ?? 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

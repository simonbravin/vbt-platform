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

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  useEffect(() => {
    if (state.costMethod === "CSV" && state.revitImportId) {
      setLoading(true);
      fetch(`/api/import/${state.revitImportId}`)
        .then((r) => r.json())
        .then((data) => {
          setImportData(data);
          // Aggregate wall areas from lines
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
    }
  }, [state.revitImportId, state.costMethod]);

  const factoryCost =
    state.costMethod === "M2_BY_SYSTEM"
      ? state.m2S80 * (settings?.rateS80 ?? 37) +
        state.m2S150 * (settings?.rateS150 ?? 67) +
        state.m2S200 * (settings?.rateS200 ?? 85)
      : state.costMethod === "M2_TOTAL"
      ? state.m2Total * (settings?.rateGlobal ?? 60)
      : null;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Step 3: Material Cost</h2>
        <p className="text-sm text-gray-500 mt-1">
          {state.costMethod === "CSV"
            ? "Review computed wall areas from your CSV import."
            : state.costMethod === "M2_BY_SYSTEM"
            ? "Enter wall area per system and review rates."
            : "Enter total wall area for a quick estimate."}
        </p>
      </div>

      {/* CSV Summary */}
      {state.costMethod === "CSV" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading import data...</p>
          ) : importData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "S80 Wall Area", value: `${state.m2S80.toFixed(1)} m²`, color: "blue" },
                  { label: "S150 Wall Area", value: `${state.m2S150.toFixed(1)} m²`, color: "purple" },
                  { label: "S200 Wall Area", value: `${state.m2S200.toFixed(1)} m²`, color: "green" },
                  { label: "Total Wall Area", value: `${(state.m2S80 + state.m2S150 + state.m2S200).toFixed(1)} m²`, color: "orange" },
                ].map((s) => (
                  <div key={s.label} className={`p-4 bg-${s.color}-50 rounded-lg border border-${s.color}-100`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
                    <p className={`text-xl font-bold text-${s.color}-700 mt-1`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Weight/Volume summary */}
              {(() => {
                let totalWeight = 0, totalVolume = 0;
                for (const line of importData.lines ?? []) {
                  if (!line.isIgnored) {
                    totalWeight += line.weightKgCored ?? 0;
                    totalVolume += line.volumeM3 ?? 0;
                  }
                }
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

              {/* Factory cost from CSV */}
              {(() => {
                const totalCost = importData.lines?.reduce((acc: number, l: any) => {
                  if (!l.isIgnored && l.pricePerM) {
                    const lm = l.linearM ?? 0;
                    return acc + lm * l.pricePerM;
                  }
                  return acc;
                }, 0) ?? 0;

                if (totalCost === 0) {
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 font-medium text-sm">⚠ No piece costs configured</p>
                      <p className="text-amber-600 text-xs mt-1">
                        Prices are zero for all pieces. The factory cost will be $0 unless you switch to M2 by System mode
                        or enter manual overrides. You can still save the quote and fill costs later.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between">
                    <p className="text-green-800 font-medium">Estimated Factory Cost (CSV)</p>
                    <p className="text-2xl font-bold text-green-700">{fmt(totalCost)}</p>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-red-500 text-sm">Could not load import data.</p>
          )}
        </div>
      )}

      {/* M2 by System */}
      {state.costMethod === "M2_BY_SYSTEM" && settings && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: "m2S80" as const, label: "S80 (80mm)", rate: settings.rateS80 },
              { key: "m2S150" as const, label: "S150 (6in)", rate: settings.rateS150 },
              { key: "m2S200" as const, label: "S200 (8in)", rate: settings.rateS200 },
            ].map((sys) => (
              <div key={sys.key} className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">{sys.label} Wall Area (m²)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={state[sys.key]}
                  onChange={(e) => update({ [sys.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
                <p className="text-xs text-gray-400 mt-1">Rate: {fmt(sys.rate)}/m²</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">= {fmt(state[sys.key] * sys.rate)}</p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <p className="text-blue-800 font-medium">Total Factory Cost</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(factoryCost!)}</p>
          </div>
        </div>
      )}

      {/* M2 Total */}
      {state.costMethod === "M2_TOTAL" && settings && (
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Wall Area (m²)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={state.m2Total}
              onChange={(e) => update({ m2Total: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            />
            <p className="text-xs text-gray-400 mt-1">Global rate: {fmt(settings.rateGlobal)}/m²</p>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <p className="text-blue-800 font-medium">Estimated Factory Cost</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(factoryCost!)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

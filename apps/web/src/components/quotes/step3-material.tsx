"use client";

import { useState, useEffect } from "react";
import type { QuoteWizardState } from "@/components/quotes/wizard-state";
import { useT } from "@/lib/i18n/context";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step3MaterialCost({ state, update }: Props) {
  const t = useT();
  const [settings, setSettings] = useState<any>(null);
  const [importData, setImportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [usingM2Fallback, setUsingM2Fallback] = useState(false);

  // Load quote defaults (effective rates only — never raw factory $/m²; no hardcoded values)
  useEffect(() => {
    fetch("/api/saas/quote-defaults")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setSettings({
        effectiveRateS80: data.effectiveRateS80 ?? 0,
        effectiveRateS150: data.effectiveRateS150 ?? 0,
        effectiveRateS200: data.effectiveRateS200 ?? 0,
      }));
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
        s80 * (settings.effectiveRateS80 ?? 0) +
        s150 * (settings.effectiveRateS150 ?? 0) +
        s200 * (settings.effectiveRateS200 ?? 0);
      setUsingM2Fallback(fallback > 0);
      update({ factoryCostUsd: fallback });
    }
  }, [importData, settings, state.costMethod]);

  // Sync factoryCostUsd for M2_BY_SYSTEM whenever inputs or settings change
  useEffect(() => {
    if (state.costMethod !== "M2_BY_SYSTEM" || !settings) return;
    const cost =
      state.m2S80 * (settings.effectiveRateS80 ?? 0) +
      state.m2S150 * (settings.effectiveRateS150 ?? 0) +
      state.m2S200 * (settings.effectiveRateS200 ?? 0);
    update({ factoryCostUsd: cost });
  }, [state.m2S80, state.m2S150, state.m2S200, settings, state.costMethod]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{t("wizard.step3Title")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {state.costMethod === "CSV"
            ? t("wizard.reviewCsvAreas")
            : t("wizard.enterWallArea")}
        </p>
      </div>

      {/* ── CSV Summary ────────────────────────────────────────────────────── */}
      {state.costMethod === "CSV" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-gray-400 text-sm">{t("wizard.loadingImportData")}</p>
          ) : importData ? (
            <>
              {/* Wall area KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t("wizard.vbt80"),  value: state.m2S80,  color: "blue"   },
                  { label: t("wizard.vbt150"), value: state.m2S150, color: "purple" },
                  { label: t("wizard.vbt200"), value: state.m2S200, color: "green"  },
                  { label: t("quotes.totalLabel"), value: state.m2S80 + state.m2S150 + state.m2S200, color: "orange" },
                ].map((s) => (
                  <div key={s.label} className={`p-4 bg-${s.color}-50 rounded-lg border border-${s.color}-100`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label} {t("wizard.wallArea")}</p>
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
                      <p className="text-xs text-gray-500 uppercase">{t("wizard.totalPanelWeight")}</p>
                      <p className="text-lg font-semibold mt-1">{totalWeight.toFixed(1)} kg</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">{t("wizard.totalPanelVolume")}</p>
                      <p className="text-lg font-semibold mt-1">{totalVolume.toFixed(2)} m³</p>
                    </div>
                  </div>
                );
              })()}

              {/* Factory cost (EXW) */}
              {usingM2Fallback && settings ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 font-medium text-sm">
                      {t("wizard.piecePricesNotConfigured")}
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">
                      {t("wizard.setPricesCatalog")}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: t("wizard.vbt80"),  m2: state.m2S80,  rate: settings.effectiveRateS80  ?? 0 },
                      { label: t("wizard.vbt150"), m2: state.m2S150, rate: settings.effectiveRateS150 ?? 0 },
                      { label: t("wizard.vbt200"), m2: state.m2S200, rate: settings.effectiveRateS200 ?? 0 },
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
                    <p className="text-blue-800 font-medium">{t("wizard.estimatedFactoryExw")}</p>
                    <p className="text-2xl font-bold text-blue-700">{fmt(state.factoryCostUsd ?? 0)}</p>
                  </div>
                </div>
              ) : (state.factoryCostUsd ?? 0) > 0 ? (
                <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between">
                  <p className="text-green-800 font-medium">{t("wizard.factoryCostCsv")}</p>
                  <p className="text-2xl font-bold text-green-700">{fmt(state.factoryCostUsd ?? 0)}</p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 font-medium text-sm">⚠ {t("wizard.noPieceCosts")}</p>
                  <p className="text-amber-600 text-xs mt-1">
                    {t("wizard.configureCatalogRates")}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-red-500 text-sm">{t("wizard.couldNotLoadImport")}</p>
          )}
        </div>
      )}

      {/* ── M2 by System ───────────────────────────────────────────────────── */}
      {state.costMethod === "M2_BY_SYSTEM" && settings && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: "m2S80"  as const, label: t("wizard.vbt80"),  rate: settings.effectiveRateS80  ?? 0 },
              { key: "m2S150" as const, label: t("wizard.vbt150"), rate: settings.effectiveRateS150 ?? 0 },
              { key: "m2S200" as const, label: t("wizard.vbt200"), rate: settings.effectiveRateS200 ?? 0 },
            ].map((sys) => (
              <div key={sys.key} className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {sys.label} {t("wizard.wallAreaM2")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={state[sys.key]}
                  onChange={(e) => update({ [sys.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
                <p className="text-xs text-gray-400 mt-1">{t("wizard.ratePerM2")}: {fmt(sys.rate)}/m²</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">
                  = {fmt(state[sys.key] * sys.rate)}
                </p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <p className="text-blue-800 font-medium">{t("wizard.totalFactoryExw")}</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(state.factoryCostUsd ?? 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

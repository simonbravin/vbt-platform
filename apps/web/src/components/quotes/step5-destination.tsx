"use client";

import { useState, useEffect } from "react";
import type { QuoteWizardState } from "@/components/quotes/wizard-state";
import { useT } from "@/lib/i18n/context";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step5Destination({ state, update }: Props) {
  const t = useT();
  const [countries, setCountries] = useState<any[]>([]);
  const [freightProfiles, setFreightProfiles] = useState<any[]>([]);
  const [taxRuleSets, setTaxRuleSets] = useState<any[]>([]);
  const [selectedTaxRules, setSelectedTaxRules] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => setCountries(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!state.countryId) return;
    Promise.all([
      fetch(`/api/freight?countryId=${state.countryId}`).then((r) => r.json()),
      fetch(`/api/tax-rules?countryId=${state.countryId}`).then((r) => r.json()),
    ]).then(([freight, taxes]) => {
      const fp = Array.isArray(freight) ? freight : [];
      const ts = Array.isArray(taxes) ? taxes : [];
      setFreightProfiles(fp);
      setTaxRuleSets(ts);
      // Auto-select default
      const def = fp.find((p: any) => p.isDefault);
      if (def && !state.freightProfileId) {
        update({
          freightProfileId: def.id,
          freightCostUsd: def.freightPerContainer * (state.numContainers || 1),
        });
      }
      // Auto-select first active rule set
      if (ts.length > 0 && !state.taxRuleSetId) {
        update({ taxRuleSetId: ts[0].id });
        setSelectedTaxRules(ts[0].rules ?? []);
      }
    });
  }, [state.countryId]);

  useEffect(() => {
    if (state.taxRuleSetId) {
      const set = taxRuleSets.find((s: any) => s.id === state.taxRuleSetId);
      if (set) setSelectedTaxRules(set.rules ?? []);
    }
  }, [state.taxRuleSetId, taxRuleSets]);

  const totalFactoryCost = (state.factoryCostUsd ?? 0) * Math.max(1, state.totalKits || 0);
  const commissionPctAmount = totalFactoryCost * (state.commissionPct / 100);
  const fob = totalFactoryCost + commissionPctAmount; // FOB = total factory + % commission; fixed in taxes & fees
  const cif = fob + state.freightCostUsd;

  // Tax preview: exclude "Local Margin" (we add single "Commission (fixed)" line); match server Option A
  const rulesForPreview = (selectedTaxRules ?? []).filter(
    (r: any) => !r.label?.toLowerCase().includes("local margin")
  );
  const taxPreview = computeTaxPreview(rulesForPreview, cif, fob, state.numContainers);
  const totalTaxes = taxPreview.reduce((a, t) => a + t.amount, 0) + state.commissionFixed;
  const landedDdp = cif + totalTaxes;

  // Sync computed financial values to wizard state so step 6 preview is accurate
  useEffect(() => {
    update({ fobUsd: fob, cifUsd: cif, taxesFeesUsd: totalTaxes, landedDdpUsd: landedDdp });
  }, [fob, cif, totalTaxes, landedDdp]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{t("wizard.step5Title")}</h2>
        <p className="text-sm text-gray-500 mt-1">{t("wizard.step5Desc")}</p>
      </div>

      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("wizard.destinationCountry")}</label>
        <select
          value={state.countryId ?? ""}
          onChange={(e) => {
            update({ countryId: e.target.value, freightProfileId: undefined, taxRuleSetId: undefined });
            setFreightProfiles([]);
            setTaxRuleSets([]);
            setSelectedTaxRules([]);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
        >
          <option value="">{t("wizard.selectCountry")}</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {/* Freight */}
      {state.countryId && (
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h3 className="font-medium text-gray-700">{t("wizard.freightLabel")}</h3>

          {freightProfiles.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("wizard.freightProfile")}</label>
              <select
                value={state.freightProfileId ?? ""}
                onChange={(e) => {
                  const fp = freightProfiles.find((p: any) => p.id === e.target.value);
                  update({
                    freightProfileId: e.target.value,
                    freightCostUsd: fp ? fp.freightPerContainer * (state.numContainers || 1) : 0,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              >
                <option value="">{t("wizard.manualEntry")}</option>
                {freightProfiles.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} – {fmt(p.freightPerContainer)}{t("wizard.perContainerSuffix")}
                    {p.isDefault ? t("wizard.defaultSuffix") : ""}
                  </option>
                ))}
              </select>
              {(() => {
                const selected = freightProfiles.find((p: any) => p.id === state.freightProfileId);
                if (!selected?.expiryDate) return null;
                const exp = new Date(selected.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                exp.setHours(0, 0, 0, 0);
                if (exp >= today) return null;
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <p className="font-medium">{t("wizard.freightExpired")} ({exp.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}).</p>
                    <p className="text-amber-700 text-xs mt-0.5">{t("wizard.considerRequote")}</p>
                  </div>
                );
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("wizard.totalFreightUsd")}{" "}
              {state.numContainers > 0 && (
                <span className="text-gray-400 font-normal">{t("wizard.forContainers", { count: state.numContainers })}</span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={state.freightCostUsd}
                onChange={(e) =>
                  update({ freightCostUsd: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 pl-6 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
          </div>

          <div className="flex justify-between pt-2 border-t text-sm">
            <span className="text-gray-500">{t("wizard.cifFobFreight")}</span>
            <span className="font-semibold">{fmt(cif)}</span>
          </div>
        </div>
      )}

      {/* Tax Rules */}
      {state.countryId && taxRuleSets.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h3 className="font-medium text-gray-700">{t("wizard.taxRules")}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("wizard.taxRuleSet")}</label>
            <select
              value={state.taxRuleSetId ?? ""}
              onChange={(e) => update({ taxRuleSetId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            >
              <option value="">{t("wizard.noTaxRules")}</option>
              {taxRuleSets.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tax preview (excludes Local Margin; we add Commission (fixed); labels "per order" for totals) */}
          {(taxPreview.length > 0 || state.commissionFixed > 0) && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase font-medium">{t("wizard.taxFeesPreview")}</p>
              {taxPreview.map((tax, i) => {
                const displayLabel = (tax.label ?? "").replace(/\s*\(per container\)/gi, " (per order)");
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{displayLabel}</span>
                    <span className="font-medium">{fmt(tax.amount)}</span>
                  </div>
                );
              })}
              {state.commissionFixed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("wizard.commissionFixedTaxes")}</span>
                  <span className="font-medium">{fmt(state.commissionFixed)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span className="text-gray-700">{t("wizard.totalTaxesFees")}</span>
                <span>{fmt(totalTaxes)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DDP Total */}
      {state.countryId && (
        <div className="bg-vbt-blue rounded-xl p-5">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-white/70 text-sm">{t("wizard.landedDdpTotal")}</p>
              <p className="text-white/50 text-xs mt-0.5">
                {t("wizard.cifAllTaxes")}
              </p>
            </div>
            <p className="text-3xl font-bold text-white">{fmt(landedDdp)}</p>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("wizard.notesOptional")}</label>
        <textarea
          rows={3}
          value={state.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={t("wizard.additionalNotesQuote")}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue resize-none"
        />
      </div>
    </div>
  );
}

function computeTaxPreview(
  rules: any[],
  cifUsd: number,
  fobUsd: number,
  numContainers: number
): { label: string; amount: number }[] {
  if (!rules?.length) return [];

  const sorted = [...rules].sort((a, b) => a.order - b.order);
  let dutyTotal = 0;
  let statisticTotal = 0;
  const results: { label: string; amount: number }[] = [];

  for (const rule of sorted) {
    let amount = 0;
    switch (rule.base) {
      case "CIF":
        amount = cifUsd * ((rule.ratePct ?? 0) / 100);
        if (rule.label.toLowerCase().includes("duty")) dutyTotal = amount;
        if (rule.label.toLowerCase().includes("statistic")) statisticTotal = amount;
        break;
      case "FOB":
        amount = fobUsd * ((rule.ratePct ?? 0) / 100);
        break;
      case "BASE_IMPONIBLE": {
        const baseImp = cifUsd + dutyTotal + statisticTotal;
        amount = baseImp * ((rule.ratePct ?? 0) / 100);
        break;
      }
      case "FIXED_PER_CONTAINER":
        amount = (rule.fixedAmount ?? 0) * numContainers;
        break;
      case "FIXED_TOTAL":
        amount = rule.fixedAmount ?? 0;
        break;
    }
    results.push({ label: rule.label, amount });
  }

  return results;
}

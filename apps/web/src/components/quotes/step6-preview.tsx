"use client";

import type { QuoteWizardState } from "@/app/(dashboard)/quotes/new/page";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useT } from "@/lib/i18n/context";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step6Preview({ state, update }: Props) {
  const t = useT();
  const totalFactoryCost = (state.factoryCostUsd ?? 0) * Math.max(1, state.totalKits || 0);
  const commissionPctAmount = totalFactoryCost * (state.commissionPct / 100);
  const fob = totalFactoryCost + commissionPctAmount; // FOB = total factory + % commission; fixed in taxes & fees
  const cif = fob + state.freightCostUsd;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const wallAreaTotal = state.m2S80 + state.m2S150 + state.m2S200 + state.m2Total;
  const totalKits = Math.max(1, state.totalKits || 0);
  const numContainers = Math.max(1, state.numContainers || 1);
  const concretePerKit = state.m2S80 * 0.08 + state.m2S150 * 0.15 + state.m2S200 * 0.2;
  const steelPerKit = state.m2S80 * 4 + state.m2S150 * 6 + state.m2S200 * 8;
  const concreteTotal = concretePerKit * totalKits;
  const steelTotal = steelPerKit * totalKits;
  const concretePerContainer = concreteTotal / numContainers;
  const steelPerContainer = steelTotal / numContainers;

  const isZeroCost = totalFactoryCost === 0;
  const landedDdp = state.landedDdpUsd ?? cif + (state.taxesFeesUsd ?? 0);
  const landedDdpPerKit = totalKits > 0 ? landedDdp / totalKits : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{t("wizard.step6Title")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("wizard.step6Desc")}
        </p>
      </div>

      {isZeroCost && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">{t("wizard.factoryCostZero")}</p>
            <p className="text-amber-600 text-sm mt-0.5">
              {t("wizard.noPieceCostsQuote")}
            </p>
          </div>
        </div>
      )}

      {/* Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t("wizard.costMethodLabel"), value: state.costMethod.replace("_", " ") },
          { label: "S80 m²", value: `${state.m2S80.toFixed(1)} m²` },
          { label: "S150 m²", value: `${state.m2S150.toFixed(1)} m²` },
          { label: "S200 m²", value: `${state.m2S200.toFixed(1)} m²` },
        ].map((item) => (
          <div key={item.label} className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-400 uppercase">{item.label}</p>
            <p className="font-semibold text-gray-800 mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <h3 className="font-medium text-gray-700">{t("wizard.financialSummary")}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t("wizard.factoryCostExw")}</span>
            <span className="font-medium">{fmt(totalFactoryCost)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>{t("wizard.fobFactoryCommission")}</span>
            <span>{fmt(fob)}</span>
          </div>
          {state.commissionFixed > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t("wizard.commissionFixedTaxes")}</span>
              <span className="font-medium">{fmt(state.commissionFixed)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">
              {t("quotes.freight")} ({state.numContainers} {t("quotes.containers")})
            </span>
            <span className="font-medium">{fmt(state.freightCostUsd)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>{t("quotes.cif")}</span>
            <span>{fmt(cif)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("quotes.totalTaxesFees")}</span>
            <span className="font-medium">{fmt(state.taxesFeesUsd ?? 0)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>{t("wizard.estimatedLandedDdp")}</span>
            <span>{fmt(landedDdp)}</span>
          </div>
          {totalKits > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("wizard.ddpPerKitLabel")}</span>
              <span className="font-medium">{fmt(landedDdpPerKit)}/kit</span>
            </div>
          )}
        </div>
      </div>

      {/* Landed DDP */}
      <div className="bg-vbt-blue rounded-xl p-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white/70 text-sm">{t("wizard.estimatedLandedDdp")}</p>
            <p className="text-white/40 text-xs mt-0.5">{t("wizard.afterTaxesFees")}</p>
          </div>
          <p className="text-3xl font-bold text-white">{fmt(landedDdp)}</p>
        </div>
        {state.totalKits > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20 space-y-1.5 text-white/70 text-sm">
            <div className="flex justify-between">
              <span>{state.totalKits} {t("quotes.kits")} × {state.numContainers} {t("quotes.containers")}</span>
              <span>{fmt(landedDdp / numContainers)}{t("wizard.perContainerSuffix")}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("quotes.perKit")}</span>
              <span>{fmt(landedDdpPerKit)}/kit</span>
            </div>
          </div>
        )}
      </div>

      {/* Informational */}
      {(concretePerKit > 0 || steelPerKit > 0) && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="font-medium text-gray-700 mb-3">{t("quotes.informational")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-lg border border-gray-100">
              <p className="text-xs text-gray-400 uppercase font-medium">{t("wizard.concreteRequired")}</p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-semibold text-gray-800">{t("quotes.perKit")}: {concretePerKit.toFixed(1)} m³</p>
                <p className="text-gray-600">{t("wizard.perContainerLabel")}: {concretePerContainer.toFixed(1)} m³</p>
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-100">
              <p className="text-xs text-gray-400 uppercase font-medium">{t("wizard.steelEstimate")}</p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-semibold text-gray-800">{t("quotes.perKit")}: {steelPerKit.toFixed(0)} kg</p>
                <p className="text-gray-600">{t("wizard.perContainerLabel")}: {steelPerContainer.toFixed(0)} kg</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("quotes.notes")}</label>
        <textarea
          rows={3}
          value={state.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={t("wizard.additionalNotesQuote")}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue resize-none"
        />
      </div>

      <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
        <CheckCircle className="w-4 h-4" />
        <p className="text-sm font-medium">{t("wizard.readyToSave")}</p>
      </div>
    </div>
  );
}

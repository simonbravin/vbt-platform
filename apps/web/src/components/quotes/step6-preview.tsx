"use client";

import type { QuoteWizardState } from "@/app/(dashboard)/quotes/new/page";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step6Preview({ state, update }: Props) {
  const factoryCost = state.factoryCostUsd ?? 0;
  const commissionPctAmount = factoryCost * (state.commissionPct / 100);
  const fob = factoryCost + commissionPctAmount; // FOB = factory + % commission; fixed in taxes & fees
  const cif = fob + state.freightCostUsd;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const wallAreaTotal = state.m2S80 + state.m2S150 + state.m2S200 + state.m2Total;
  const concreteEst = state.m2S80 * 0.08 + state.m2S150 * 0.15 + state.m2S200 * 0.2;
  const steelEst = state.m2S80 * 4 + state.m2S150 * 6 + state.m2S200 * 8;

  const isZeroCost = factoryCost === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Step 6: Quote Preview</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review the complete quote before saving. You can edit the quote after creation.
        </p>
      </div>

      {isZeroCost && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Factory cost is $0</p>
            <p className="text-amber-600 text-sm mt-0.5">
              No piece costs are configured. The quote will be saved but all financial figures will be $0.
              You can update piece costs in the catalog and recalculate.
            </p>
          </div>
        </div>
      )}

      {/* Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Cost Method", value: state.costMethod.replace("_", " ") },
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
        <h3 className="font-medium text-gray-700">Financial Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Factory Cost ({state.costMethod})</span>
            <span className="font-medium">{fmt(factoryCost)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>FOB (factory + % commission)</span>
            <span>{fmt(fob)}</span>
          </div>
          {state.commissionFixed > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Commission (fixed, in taxes & fees)</span>
              <span className="font-medium">{fmt(state.commissionFixed)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">
              Freight ({state.numContainers} container{state.numContainers !== 1 ? "s" : ""})
            </span>
            <span className="font-medium">{fmt(state.freightCostUsd)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>CIF</span>
            <span>{fmt(cif)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total taxes & fees</span>
            <span className="font-medium">{fmt(state.taxesFeesUsd ?? 0)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Estimated landed DDP</span>
            <span>{fmt(state.landedDdpUsd ?? cif + (state.taxesFeesUsd ?? 0))}</span>
          </div>
        </div>
      </div>

      {/* Landed DDP */}
      <div className="bg-vbt-blue rounded-xl p-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white/70 text-sm">Estimated Landed / DDP</p>
            <p className="text-white/40 text-xs mt-0.5">After taxes & fees</p>
          </div>
          <p className="text-3xl font-bold text-white">{fmt(state.landedDdpUsd ?? cif + (state.taxesFeesUsd ?? 0))}</p>
        </div>
        {state.totalKits > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-white/70 text-sm">
            <span>{state.totalKits} kits × {state.numContainers} container{state.numContainers !== 1 ? "s" : ""}</span>
            <span>
              {fmt((state.landedDdpUsd ?? cif) / Math.max(state.numContainers, 1))}/container
            </span>
          </div>
        )}
      </div>

      {/* Informational */}
      {(concreteEst > 0 || steelEst > 0) && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="font-medium text-gray-700 mb-3">Informational (not in cost)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase">Concrete Required</p>
              <p className="text-lg font-semibold mt-1">{concreteEst.toFixed(1)} m³</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Steel Estimate</p>
              <p className="text-lg font-semibold mt-1">{steelEst.toFixed(0)} kg</p>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          value={state.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Add any additional notes to include in the quote..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue resize-none"
        />
      </div>

      <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
        <CheckCircle className="w-4 h-4" />
        <p className="text-sm font-medium">Ready to save as draft. You can edit and send later.</p>
      </div>
    </div>
  );
}

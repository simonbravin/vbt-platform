"use client";

import type { QuoteWizardState } from "@/app/(dashboard)/quotes/new/page";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step4Commission({ state, update }: Props) {
  const factoryCost = state.factoryCostUsd ?? 0;
  const commissionAmount = factoryCost * (state.commissionPct / 100) + state.commissionFixed;
  const fob = factoryCost + commissionAmount;
  const numContainers = state.kitsPerContainer > 0
    ? Math.ceil(state.totalKits / state.kitsPerContainer)
    : state.numContainers;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Step 4: Commission & Logistics</h2>
        <p className="text-sm text-gray-500 mt-1">Set the VBT commission and container logistics.</p>
      </div>

      {/* Commission */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-gray-700">Commission (Vision Latam)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={state.commissionPct}
                onChange={(e) => update({ commissionPct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commission Fixed (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={state.commissionFixed}
                onChange={(e) => update({ commissionFixed: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pl-6 focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
          </div>
        </div>

        {/* FOB Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Factory Cost</span>
            <span className="font-medium">{fmt(factoryCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Commission ({state.commissionPct}% + {fmt(state.commissionFixed)})
            </span>
            <span className="font-medium">{fmt(commissionAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold pt-2 border-t">
            <span className="text-vbt-blue">FOB Total</span>
            <span className="text-vbt-blue">{fmt(fob)}</span>
          </div>
        </div>
      </div>

      {/* Logistics */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-gray-700">Container Logistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Kits</label>
            <input
              type="number"
              min="0"
              step="1"
              value={state.totalKits}
              onChange={(e) => {
                const totalKits = parseInt(e.target.value) || 0;
                const numContainers = state.kitsPerContainer > 0
                  ? Math.ceil(totalKits / state.kitsPerContainer)
                  : state.numContainers;
                update({ totalKits, numContainers });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kits per Container</label>
            <input
              type="number"
              min="0"
              step="1"
              value={state.kitsPerContainer}
              onChange={(e) => {
                const kitsPerContainer = parseInt(e.target.value) || 0;
                const numContainers = kitsPerContainer > 0 && state.totalKits > 0
                  ? Math.ceil(state.totalKits / kitsPerContainer)
                  : state.numContainers;
                update({ kitsPerContainer, numContainers });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Containers (auto)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={numContainers}
              onChange={(e) => update({ numContainers: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            />
            {state.kitsPerContainer > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Auto: ⌈{state.totalKits} / {state.kitsPerContainer}⌉ = {numContainers}
              </p>
            )}
          </div>
        </div>

        {/* Unit prices */}
        {fob > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="text-center p-3 bg-white rounded-lg border">
              <p className="text-xs text-gray-400 uppercase">FOB per Container</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {fmt(numContainers > 0 ? fob / numContainers : 0)}
              </p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <p className="text-xs text-gray-400 uppercase">FOB per Kit</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {fmt(state.totalKits > 0 ? fob / state.totalKits : 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import type { QuoteWizardState } from "@/app/(dashboard)/quotes/new/page";

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

export function Step4Commission({ state, update }: Props) {
  const factoryCost = state.factoryCostUsd ?? 0;
  const numContainers = state.kitsPerContainer > 0 && state.totalKits > 0
    ? Math.ceil(state.totalKits / state.kitsPerContainer)
    : state.numContainers;

  const commissionPctAmount = factoryCost * (state.commissionPct / 100);
  const commissionFixedPerKitAmount = state.commissionFixedPerKit * (state.totalKits || 0);
  const commissionAmount = commissionPctAmount + state.commissionFixed + commissionFixedPerKitAmount;
  const fob = factoryCost + commissionAmount;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Step 4: Logistics & Commission</h2>
        <p className="text-sm text-gray-500 mt-1">Set container logistics first, then apply VBT commission.</p>
      </div>

      {/* Container Logistics — FIRST so per-kit commission has total kits */}
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
                const derived = state.kitsPerContainer > 0 && totalKits > 0
                  ? Math.ceil(totalKits / state.kitsPerContainer)
                  : state.numContainers;
                update({ totalKits, numContainers: derived });
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
                const derived = kitsPerContainer > 0 && state.totalKits > 0
                  ? Math.ceil(state.totalKits / kitsPerContainer)
                  : state.numContainers;
                update({ kitsPerContainer, numContainers: derived });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Containers</label>
            <input
              type="number"
              min="1"
              step="1"
              value={numContainers}
              onChange={(e) => update({ numContainers: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
            />
            {state.kitsPerContainer > 0 && state.totalKits > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Auto: ⌈{state.totalKits} / {state.kitsPerContainer}⌉ = {numContainers}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Commission */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-gray-700">Commission (Vision Latam)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            {state.commissionPct > 0 && (
              <p className="text-xs text-gray-400 mt-1">= {fmt(commissionPctAmount)}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed per Order (USD)</label>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed per Kit (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={state.commissionFixedPerKit}
                onChange={(e) => update({ commissionFixedPerKit: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pl-6 focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
            {state.commissionFixedPerKit > 0 && state.totalKits > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {fmt(state.commissionFixedPerKit)} × {state.totalKits} kits = {fmt(commissionFixedPerKitAmount)}
              </p>
            )}
          </div>
        </div>

        {/* FOB Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Factory Cost</span>
            <span className="font-medium">{fmt(factoryCost)}</span>
          </div>
          {commissionPctAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Commission {state.commissionPct}%</span>
              <span className="font-medium">{fmt(commissionPctAmount)}</span>
            </div>
          )}
          {state.commissionFixed > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fixed per Order</span>
              <span className="font-medium">{fmt(state.commissionFixed)}</span>
            </div>
          )}
          {commissionFixedPerKitAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fixed per Kit ({state.totalKits} kits)</span>
              <span className="font-medium">{fmt(commissionFixedPerKitAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold pt-2 border-t">
            <span className="text-vbt-blue">FOB Total</span>
            <span className="text-vbt-blue">{fmt(fob)}</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {fob > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-white rounded-xl border border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-wide">FOB per Container</p>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {fmt(numContainers > 0 ? fob / numContainers : 0)}
            </p>
          </div>
          <div className="text-center p-4 bg-white rounded-xl border border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-wide">FOB per Kit</p>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {fmt(state.totalKits > 0 ? fob / state.totalKits : 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

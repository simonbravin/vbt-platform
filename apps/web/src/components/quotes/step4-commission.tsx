"use client";

import { useEffect, useRef } from "react";
import type { QuoteWizardState } from "@/app/(dashboard)/quotes/new/page";

// Packing capacity: m² of wall panels per 40ft HC container
const CAP_S80 = 650;
const CAP_S150 = 420;
const CAP_S200 = 300;

interface Props {
  state: QuoteWizardState;
  update: (patch: Partial<QuoteWizardState>) => void;
}

// CSV / Step 3 always yield cost for one kit; total factory = perKit × totalKits (school, 150 houses, etc.).
export function Step4Commission({ state, update }: Props) {
  const factoryCostPerKit = state.factoryCostUsd ?? 0;
  const totalKits = Math.max(1, state.totalKits || 0);
  const totalFactoryCost = factoryCostPerKit * totalKits;
  const numContainers =
    state.kitsPerContainer > 0 && state.totalKits > 0
      ? Math.ceil(state.totalKits / state.kitsPerContainer)
      : state.numContainers;
  const loadedProjectIdRef = useRef<string | null>(null);

  // Load totalKits and kitsPerContainer from project once when projectId is set (user can still edit)
  useEffect(() => {
    if (!state.projectId || state.projectId === loadedProjectIdRef.current) return;
    loadedProjectIdRef.current = state.projectId;
    fetch(`/api/projects/${state.projectId}`)
      .then((r) => r.json())
      .then((p: { totalKits?: number; kitsPerContainer?: number } | null) => {
        if (!p) return;
        const totalKits = Math.max(1, p.totalKits ?? 1);
        const kitsPerContainer = p.kitsPerContainer ?? 0;
        const rawFromM2 = (state.m2S80 / CAP_S80) + (state.m2S150 / CAP_S150) + (state.m2S200 / CAP_S200);
        const derived =
          kitsPerContainer > 0 && totalKits > 0
            ? Math.ceil(totalKits / kitsPerContainer)
            : Math.ceil(rawFromM2) || 1;
        update({
          totalKits,
          kitsPerContainer,
          numContainers: derived,
        });
      })
      .catch(() => {});
  }, [state.projectId]);

  // Auto-set numContainers from m² packing capacity when kits are not configured
  useEffect(() => {
    const raw = (state.m2S80 / CAP_S80) + (state.m2S150 / CAP_S150) + (state.m2S200 / CAP_S200);
    if (raw > 0 && !(state.totalKits > 0 && state.kitsPerContainer > 0)) {
      update({ numContainers: Math.ceil(raw) });
    }
  }, [state.m2S80, state.m2S150, state.m2S200]);

  // m² packing suggestion for display
  const rawContainersFromM2 =
    (state.m2S80 / CAP_S80) + (state.m2S150 / CAP_S150) + (state.m2S200 / CAP_S200);

  const commissionPctAmount = totalFactoryCost * (state.commissionPct / 100);
  const commissionAmount = commissionPctAmount + state.commissionFixed;
  const fob = totalFactoryCost + commissionPctAmount; // FOB = total factory + % commission; fixed is in taxes & fees (step 5)

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Step 4: Logistics & Commission</h2>
        <p className="text-sm text-gray-500 mt-1">Set container logistics first, then apply VBT commission.</p>
      </div>

      {/* ── 1. Container Logistics ───────────────────────────────────────────── */}
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
                const derived =
                  state.kitsPerContainer > 0 && totalKits > 0
                    ? Math.ceil(totalKits / state.kitsPerContainer)
                    : state.numContainers;
                // Re-sync per-kit when kits change
                const commissionFixedPerKit =
                  totalKits > 0 ? state.commissionFixed / totalKits : 0;
                update({ totalKits, numContainers: derived, commissionFixedPerKit });
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
                const derived =
                  kitsPerContainer > 0 && state.totalKits > 0
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
                ⌈{state.totalKits} / {state.kitsPerContainer}⌉ = {numContainers}
              </p>
            )}
            {rawContainersFromM2 > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                m²: ≈{rawContainersFromM2.toFixed(2)} →{" "}
                {Math.ceil(rawContainersFromM2)} · uses{" "}
                {((rawContainersFromM2 / Math.ceil(rawContainersFromM2)) * 100).toFixed(0)}% of capacity
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Commission ────────────────────────────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-gray-700">Commission (Vision Latam)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Commission % */}
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
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
            </div>
            {state.commissionPct > 0 && (
              <p className="text-xs text-gray-400 mt-1">= {fmt(commissionPctAmount)}</p>
            )}
          </div>

          {/* Fixed per Order — source of truth; editing this updates per-kit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed per Order (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={state.commissionFixed}
                onChange={(e) => {
                  const commissionFixed = parseFloat(e.target.value) || 0;
                  const commissionFixedPerKit =
                    state.totalKits > 0 ? commissionFixed / state.totalKits : 0;
                  update({ commissionFixed, commissionFixedPerKit });
                }}
                className="w-full px-3 py-2 pl-6 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
            {state.commissionFixed > 0 && state.totalKits > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                = {fmt(state.commissionFixed / state.totalKits)}/kit
              </p>
            )}
          </div>

          {/* Fixed per Kit — editing this updates per-order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed per Kit (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={state.commissionFixedPerKit}
                onChange={(e) => {
                  const commissionFixedPerKit = parseFloat(e.target.value) || 0;
                  const commissionFixed = commissionFixedPerKit * (state.totalKits || 0);
                  update({ commissionFixed, commissionFixedPerKit });
                }}
                className="w-full px-3 py-2 pl-6 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
            {state.commissionFixedPerKit > 0 && state.totalKits > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {fmt(state.commissionFixedPerKit)} × {state.totalKits} kits = {fmt(state.commissionFixed)}
              </p>
            )}
          </div>
        </div>

        {/* FOB and commission summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Factory cost (EXW)</span>
            <span className="font-medium">{fmt(totalFactoryCost)}</span>
          </div>
          {totalKits > 1 && (
            <p className="text-xs text-gray-500">
              {fmt(factoryCostPerKit)}/kit × {totalKits} kits = {fmt(totalFactoryCost)}
            </p>
          )}
          <div className="flex justify-between text-base font-semibold pt-2 border-t">
            <span className="text-vbt-blue">FOB (factory + % commission)</span>
            <span className="text-vbt-blue">{fmt(fob)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Fixed commission is applied in taxes & fees in the next step.</p>
          {commissionAmount > 0 && (
            <>
              {commissionPctAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Commission {state.commissionPct}%</span>
                  <span className="font-medium">{fmt(commissionPctAmount)}</span>
                </div>
              )}
              {state.commissionFixed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Fixed ({state.totalKits > 0 ? `${fmt(state.commissionFixedPerKit)}/kit × ${state.totalKits}` : "per order"})
                  </span>
                  <span className="font-medium">{fmt(state.commissionFixed)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total commission (in taxes & fees)</span>
                <span className="font-medium">{fmt(commissionAmount)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 3. KPIs ──────────────────────────────────────────────────────────── */}
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

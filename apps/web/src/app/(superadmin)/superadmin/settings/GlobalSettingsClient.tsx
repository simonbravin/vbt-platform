"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign, Eye, Building2, Lock, Loader2 } from "lucide-react";

type Config = {
  pricing?: {
    defaultMarginMinPct?: number;
    defaultEntryFeeUsd?: number;
    defaultTrainingFeeUsd?: number;
    visionLatamCommissionPct?: number;
  };
  moduleVisibility?: Record<string, boolean>;
};

const MODULE_KEYS = [
  { key: "engineering", label: "Engineering" },
  { key: "documents", label: "Documents" },
  { key: "training", label: "Training" },
  { key: "reports", label: "Reports" },
];

export function GlobalSettingsClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [marginMinPct, setMarginMinPct] = useState<string>("");
  const [entryFeeUsd, setEntryFeeUsd] = useState<string>("");
  const [trainingFeeUsd, setTrainingFeeUsd] = useState<string>("");
  const [visionLatamCommissionPct, setVisionLatamCommissionPct] = useState<string>("20");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/saas/platform-config");
        if (!res.ok) throw new Error("Failed to load config");
        const data = await res.json();
        if (cancelled) return;
        setConfig(data);
        setMarginMinPct(String(data?.pricing?.defaultMarginMinPct ?? ""));
        setEntryFeeUsd(String(data?.pricing?.defaultEntryFeeUsd ?? ""));
        setTrainingFeeUsd(String(data?.pricing?.defaultTrainingFeeUsd ?? ""));
        setVisionLatamCommissionPct(String(data?.pricing?.visionLatamCommissionPct ?? "20"));
        setVisibility((data?.moduleVisibility as Record<string, boolean>) ?? {});
      } catch (e) {
        if (!cancelled) setMessage({ type: "error", text: "Failed to load configuration" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Config = {
        pricing: {
          defaultMarginMinPct: marginMinPct === "" ? undefined : Number(marginMinPct),
          defaultEntryFeeUsd: entryFeeUsd === "" ? undefined : Number(entryFeeUsd),
          defaultTrainingFeeUsd: trainingFeeUsd === "" ? undefined : Number(trainingFeeUsd),
          visionLatamCommissionPct: visionLatamCommissionPct === "" ? undefined : Number(visionLatamCommissionPct),
        },
        moduleVisibility: visibility,
      };
      const res = await fetch("/api/saas/platform-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save");
      }
      const data = await res.json();
      setConfig(data);
      setMessage({ type: "success", text: "Settings saved." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Pricing defaults</h2>
              <p className="text-sm text-gray-500">Default margin and fees. Partners inherit or override.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Min margin %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={marginMinPct}
                onChange={(e) => setMarginMinPct(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. 15"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Default entry fee (USD)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={entryFeeUsd}
                onChange={(e) => setEntryFeeUsd(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. 0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Default training fee (USD)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={trainingFeeUsd}
                onChange={(e) => setTrainingFeeUsd(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. 0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Vision Latam commission % (partner base price = factory cost + this %)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={visionLatamCommissionPct}
                onChange={(e) => setVisionLatamCommissionPct(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="20"
              />
              <p className="mt-0.5 text-xs text-gray-400">Partners never see factory cost; they see base price = factory + this commission.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Module visibility</h2>
              <p className="text-sm text-gray-500">Which modules partners see by default.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {MODULE_KEYS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility[key] ?? true}
                  onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <Lock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Override toggles</h2>
              <p className="text-sm text-gray-500">Allow or lock partner overrides (future).</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Coming when override lock model is available.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-vbt-blue/10 p-2">
              <Building2 className="h-5 w-5 text-vbt-blue" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Partner parameters</h2>
              <p className="text-sm text-gray-500">Set overrides per partner in the partner detail.</p>
            </div>
          </div>
          <Link href="/superadmin/partners" className="mt-4 inline-block text-sm font-medium text-vbt-blue hover:underline">
            Go to Partners →
          </Link>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

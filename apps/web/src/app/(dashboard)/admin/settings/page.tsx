"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(setSettings);
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) setMsg("Settings saved successfully.");
    else setMsg("Failed to save settings.");
  };

  const upd = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }));

  if (!settings) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configure default rates and preferences</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-700">Units</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "baseUom", label: "Base UOM", opts: ["M", "FT"] },
            { key: "weightUom", label: "Weight UOM", opts: ["KG", "LBS"] },
          ].map(({ key, label, opts }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <select
                value={settings[key] ?? ""}
                onChange={(e) => upd(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              >
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <h2 className="font-semibold text-gray-700 pt-2">Rates (USD/m²)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "rateS80", label: "S80 Rate" },
            { key: "rateS150", label: "S150 Rate" },
            { key: "rateS200", label: "S200 Rate" },
            { key: "rateGlobal", label: "Global Rate" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={settings[key] ?? 0}
                  onChange={(e) => upd(key, parseFloat(e.target.value) || 0)}
                  className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
                />
              </div>
            </div>
          ))}
        </div>

        <h2 className="font-semibold text-gray-700 pt-2">Min Production Run & Commission</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "minRunFt", label: "Min Run (ft)", step: 100 },
            { key: "commissionPct", label: "Commission %", step: 0.5 },
            { key: "commissionFixed", label: "Commission Fixed ($)", step: 100 },
          ].map(({ key, label, step }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="number"
                min="0"
                step={step}
                value={settings[key] ?? 0}
                onChange={(e) => upd(key, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vbt-blue"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

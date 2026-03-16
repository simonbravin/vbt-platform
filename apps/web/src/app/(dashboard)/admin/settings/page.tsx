"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/context";

export default function SettingsPage() {
  const t = useT();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<"success" | "error" | null>(null);

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
    if (res.ok) setMsg("success");
    else setMsg("error");
  };

  const upd = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }));

  if (!settings) return <div className="p-8 text-center text-gray-400">{t("common.loading")}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("admin.settings.title")}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t("admin.settings.subtitle")}</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg === "success" ? t("admin.settings.saved") : t("admin.settings.saveFailed")}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-700">{t("admin.settings.units")}</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "baseUom", labelKey: "admin.settings.baseUom", opts: ["M", "FT"] },
            { key: "weightUom", labelKey: "admin.settings.weightUom", opts: ["KG", "LBS"] },
          ].map(({ key, labelKey, opts }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t(labelKey)}</label>
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

        <p className="text-sm text-gray-500 pt-1">System rates (USD/m²) are set by Vision Latam in Global Settings and are not editable here.</p>

        <h2 className="font-semibold text-gray-700 pt-2">{t("admin.settings.minRun")}</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "minRunFt", labelKey: "admin.settings.minRunFt", step: 100 },
            { key: "commissionPct", labelKey: "admin.settings.commissionPct", step: 0.5 },
            { key: "commissionFixed", labelKey: "admin.settings.commissionFixed", step: 100 },
          ].map(({ key, labelKey, step }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t(labelKey)}</label>
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
            {saving ? t("common.saving") : t("admin.settings.saveSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}

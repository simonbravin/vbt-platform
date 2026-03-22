"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/context";

export default function SettingsPage() {
  const t = useT();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<"success" | "error" | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    setErrorDetail(null);
    fetch("/api/admin/settings")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErrorDetail(data?.error ?? ` ${r.status}`);
          setSettings(null);
          return;
        }
        setSettings(data);
      })
      .catch(() => setSettings(null));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setErrorDetail(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUom: settings?.baseUom,
          weightUom: settings?.weightUom,
          minRunFt: settings?.minRunFt,
          commissionPct: settings?.commissionPct,
          commissionFixed: settings?.commissionFixed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("success");
        setSettings((prev: any) => ({ ...prev, ...data }));
        setTimeout(() => setMsg(null), 4000);
      } else {
        setMsg("error");
        setErrorDetail(data?.error ?? t("admin.settings.saveFailed"));
      }
    } catch {
      setMsg("error");
      setErrorDetail(t("admin.settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const upd = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }));

  if (errorDetail && !settings) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="rounded-sm border border-alert-errorBorder bg-alert-error p-4 text-sm text-foreground">
          {t("admin.settings.failedToLoad")}: {errorDetail}
        </div>
      </div>
    );
  }

  if (!settings) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.settings.title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("admin.settings.subtitle")}</p>
      </div>

      {msg && (
        <div
          className={`rounded-sm border p-3 text-sm ${
            msg === "success"
              ? "border-alert-successBorder bg-alert-success text-foreground"
              : "border-alert-errorBorder bg-alert-error text-foreground"
          }`}
        >
          {msg === "success" ? t("admin.settings.saved") : (errorDetail ?? t("admin.settings.saveFailed"))}
        </div>
      )}

      <div className="surface-card p-6 space-y-5">
        <h2 className="font-semibold text-foreground">{t("admin.settings.units")}</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "baseUom", labelKey: "admin.settings.baseUom", opts: ["M", "FT"] },
            { key: "weightUom", labelKey: "admin.settings.weightUom", opts: ["KG", "LBS"] },
          ].map(({ key, labelKey, opts }) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-foreground">{t(labelKey)}</label>
              <select
                value={settings[key] ?? ""}
                onChange={(e) => upd(key, e.target.value)}
                className="input-native"
              >
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <p className="pt-1 text-sm text-muted-foreground">System rates (USD/m²) are set by Vision Latam in Global Settings and are not editable here.</p>

        <h2 className="pt-2 font-semibold text-foreground">{t("admin.settings.minRun")}</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "minRunFt", labelKey: "admin.settings.minRunFt", step: 100 },
            { key: "commissionPct", labelKey: "admin.settings.commissionPct", step: 0.5 },
            { key: "commissionFixed", labelKey: "admin.settings.commissionFixed", step: 100 },
          ].map(({ key, labelKey, step }) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-foreground">{t(labelKey)}</label>
              <input
                type="number"
                min="0"
                step={step}
                value={settings[key] ?? 0}
                onChange={(e) => upd(key, parseFloat(e.target.value) || 0)}
                className="input-native"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-sm border border-primary/20 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("admin.settings.saveSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}

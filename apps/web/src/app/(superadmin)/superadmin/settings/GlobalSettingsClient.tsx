"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign, Eye, Building2, Lock, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Config = {
  pricing?: {
    defaultMarginMinPct?: number;
    defaultMarginMaxPct?: number;
    defaultEntryFeeUsd?: number;
    defaultTrainingFeeUsd?: number;
    visionLatamCommissionPct?: number;
    rateS80?: number;
    rateS150?: number;
    rateS200?: number;
    rateGlobal?: number;
    baseUom?: "M" | "FT";
    minRunFt?: number;
  };
  moduleVisibility?: Record<string, boolean>;
};

const MODULE_KEYS = [
  { key: "engineering", labelKey: "superadmin.settings.engineering" },
  { key: "documents", labelKey: "superadmin.settings.documents" },
  { key: "training", labelKey: "superadmin.settings.training" },
  { key: "reports", labelKey: "superadmin.settings.reports" },
];

export function GlobalSettingsClient() {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [marginMinPct, setMarginMinPct] = useState<string>("");
  const [marginMaxPct, setMarginMaxPct] = useState<string>("");
  const [entryFeeUsd, setEntryFeeUsd] = useState<string>("");
  const [trainingFeeUsd, setTrainingFeeUsd] = useState<string>("");
  const [visionLatamCommissionPct, setVisionLatamCommissionPct] = useState<string>("20");
  const [rateS80, setRateS80] = useState<string>("");
  const [rateS150, setRateS150] = useState<string>("");
  const [rateS200, setRateS200] = useState<string>("");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/saas/platform-config");
        if (!res.ok) throw new Error(t("superadmin.settings.failedToLoad"));
        const data = await res.json();
        if (cancelled) return;
        setConfig(data);
        setMarginMinPct(String(data?.pricing?.defaultMarginMinPct ?? ""));
        setMarginMaxPct(String(data?.pricing?.defaultMarginMaxPct ?? ""));
        setEntryFeeUsd(String(data?.pricing?.defaultEntryFeeUsd ?? ""));
        setTrainingFeeUsd(String(data?.pricing?.defaultTrainingFeeUsd ?? ""));
        setVisionLatamCommissionPct(String(data?.pricing?.visionLatamCommissionPct ?? "20"));
        setVisibility((data?.moduleVisibility as Record<string, boolean>) ?? {});
      } catch (e) {
        if (!cancelled) setMessage({ type: "error", text: t("superadmin.settings.failedToLoadConfig") });
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
          defaultMarginMaxPct: marginMaxPct === "" ? undefined : Number(marginMaxPct),
          defaultEntryFeeUsd: entryFeeUsd === "" ? undefined : Number(entryFeeUsd),
          defaultTrainingFeeUsd: trainingFeeUsd === "" ? undefined : Number(trainingFeeUsd),
          visionLatamCommissionPct: visionLatamCommissionPct === "" ? undefined : Number(visionLatamCommissionPct),
          rateS80: rateS80 === "" ? undefined : Number(rateS80),
          rateS150: rateS150 === "" ? undefined : Number(rateS150),
          rateS200: rateS200 === "" ? undefined : Number(rateS200),
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
        throw new Error(err?.error ?? t("superadmin.settings.saveFailed"));
      }
      const data = await res.json();
      setConfig(data);
      setMessage({ type: "success", text: t("superadmin.settings.saved") });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : t("superadmin.settings.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`rounded-sm border p-3 text-sm ${
            message.type === "success" ? "border-alert-successBorder bg-alert-success text-foreground" : "border-alert-errorBorder bg-alert-error text-foreground"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t("superadmin.settings.pricing")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.settings.pricingDescription")}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.settings.minMarginLabel")}</label>
              <p className="mt-0.5 text-xs text-muted-foreground/80">{t("superadmin.settings.minMarginHelp")}</p>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={marginMinPct}
                onChange={(e) => setMarginMinPct(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder={t("superadmin.settings.placeholderEg15")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.settings.maxMarginLabel")}</label>
              <p className="mt-0.5 text-xs text-muted-foreground/80">{t("superadmin.settings.maxMarginHelp")}</p>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={marginMaxPct}
                onChange={(e) => setMarginMaxPct(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder={t("superadmin.settings.placeholderEg20")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.settings.entryFeeLabel")}</label>
              <input
                type="number"
                min={0}
                step={1}
                value={entryFeeUsd}
                onChange={(e) => setEntryFeeUsd(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder={t("superadmin.settings.placeholderZero")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.settings.trainingFeeLabel")}</label>
              <input
                type="number"
                min={0}
                step={1}
                value={trainingFeeUsd}
                onChange={(e) => setTrainingFeeUsd(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder={t("superadmin.settings.placeholderZero")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.settings.vlCommissionLabel")}</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={visionLatamCommissionPct}
                onChange={(e) => setVisionLatamCommissionPct(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder={t("superadmin.settings.placeholderEg20")}
              />
              <p className="mt-0.5 text-xs text-muted-foreground">{t("superadmin.settings.vlCommissionHelp")}</p>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("superadmin.settings.factoryRatesIntro")}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground">{t("superadmin.settings.rateS80Label")}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={rateS80}
                    onChange={(e) => setRateS80(e.target.value)}
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    placeholder={t("superadmin.settings.placeholderEg37")}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">{t("superadmin.settings.rateS150Label")}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={rateS150}
                    onChange={(e) => setRateS150(e.target.value)}
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    placeholder={t("superadmin.settings.placeholderEg67")}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">{t("superadmin.settings.rateS200Label")}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={rateS200}
                    onChange={(e) => setRateS200(e.target.value)}
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    placeholder={t("superadmin.settings.placeholderEg85")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t("superadmin.settings.moduleVisibility")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.settings.moduleVisibilityHelp")}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {MODULE_KEYS.map(({ key, labelKey }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility[key] ?? true}
                  onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted p-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t("superadmin.settings.overrideTogglesTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.settings.overrideTogglesHelp")}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("superadmin.settings.overrideTogglesComing")}</p>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t("superadmin.settings.partnerParamsTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.settings.partnerParamsHelp")}</p>
            </div>
          </div>
          <Link href="/superadmin/partners" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            {t("superadmin.settings.goToPartners")}
          </Link>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("superadmin.settings.save")}
        </button>
      </div>
    </div>
  );
}

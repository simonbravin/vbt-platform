"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DollarSign, Eye, Building2, Lock, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { saasApiErrorMessageOr } from "@/lib/saas-api-error-message";
import type { EffectivePlatformPricing, PricingFieldMeta } from "@vbt/core";

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
  };
  moduleVisibility?: Record<string, boolean>;
  effectivePricing?: EffectivePlatformPricing;
};

const MODULE_KEYS = [
  { key: "dashboard", labelKey: "nav.dashboard" },
  { key: "clients", labelKey: "nav.clients" },
  { key: "engineering", labelKey: "superadmin.settings.engineering" },
  { key: "projects", labelKey: "nav.projects" },
  { key: "quotes", labelKey: "nav.quotes" },
  { key: "sales", labelKey: "nav.sales" },
  { key: "inventory", labelKey: "nav.inventory" },
  { key: "documents", labelKey: "superadmin.settings.documents" },
  { key: "training", labelKey: "superadmin.settings.training" },
  { key: "reports", labelKey: "superadmin.settings.reports" },
  { key: "settings", labelKey: "nav.settings" },
];

function formatDisplayValue(value: number | null, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}${suffix}`;
}

function persistedToEditString(persisted: number | null): string {
  return persisted != null && Number.isFinite(persisted) ? String(persisted) : "";
}

function parseOptionalNumberField(value: string): number | undefined | null {
  if (value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function PricingNumericField({
  label,
  help,
  meta,
  editValue,
  onEditChange,
  onRestoreDefault,
  step = 1,
  min = 0,
  max,
  suffix = "",
  stackEdit = false,
}: {
  label: string;
  help?: string;
  meta?: PricingFieldMeta;
  editValue: string;
  onEditChange: (v: string) => void;
  onRestoreDefault?: () => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** When true, new value stacks below current (for narrow multi-column layouts). */
  stackEdit?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {help ? <p className="mt-0.5 text-xs text-muted-foreground/80">{help}</p> : null}
      <div
        className={`mt-1 grid grid-cols-1 items-end gap-2 ${stackEdit ? "" : "sm:grid-cols-2"}`}
      >
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("superadmin.settings.currentValueLabel")}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatDisplayValue(meta?.effective ?? null, suffix)}
            </span>
            {meta?.usesSystemDefault ? (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("superadmin.settings.systemDefaultBadge")}
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("superadmin.settings.newValueLabel")}
          </label>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>
      {onRestoreDefault && meta?.usesSystemDefault === false ? (
        <button
          type="button"
          onClick={onRestoreDefault}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {t("superadmin.settings.restoreSystemDefault")}
        </button>
      ) : null}
    </div>
  );
}

export function GlobalSettingsClient() {
  const t = useT();
  const [effectivePricing, setEffectivePricing] = useState<EffectivePlatformPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [marginMinPct, setMarginMinPct] = useState<string>("");
  const [marginMaxPct, setMarginMaxPct] = useState<string>("");
  const [entryFeeUsd, setEntryFeeUsd] = useState<string>("");
  const [trainingFeeUsd, setTrainingFeeUsd] = useState<string>("");
  const [visionLatamCommissionPct, setVisionLatamCommissionPct] = useState<string>("");
  const [rateS80, setRateS80] = useState<string>("");
  const [rateS150, setRateS150] = useState<string>("");
  const [rateS200, setRateS200] = useState<string>("");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  const applyLoadedConfig = useCallback((data: Config) => {
    const ep = data.effectivePricing ?? null;
    setEffectivePricing(ep);
    setMarginMinPct(persistedToEditString(ep?.defaultMarginMinPct?.persisted ?? data?.pricing?.defaultMarginMinPct ?? null));
    setMarginMaxPct(persistedToEditString(ep?.defaultMarginMaxPct?.persisted ?? data?.pricing?.defaultMarginMaxPct ?? null));
    setEntryFeeUsd(persistedToEditString(ep?.defaultEntryFeeUsd?.persisted ?? data?.pricing?.defaultEntryFeeUsd ?? null));
    setTrainingFeeUsd(persistedToEditString(ep?.defaultTrainingFeeUsd?.persisted ?? data?.pricing?.defaultTrainingFeeUsd ?? null));
    setVisionLatamCommissionPct(
      persistedToEditString(ep?.visionLatamCommissionPct?.persisted ?? data?.pricing?.visionLatamCommissionPct ?? null)
    );
    setRateS80(persistedToEditString(ep?.rateS80?.persisted ?? data?.pricing?.rateS80 ?? null));
    setRateS150(persistedToEditString(ep?.rateS150?.persisted ?? data?.pricing?.rateS150 ?? null));
    setRateS200(persistedToEditString(ep?.rateS200?.persisted ?? data?.pricing?.rateS200 ?? null));
    setVisibility((data?.moduleVisibility as Record<string, boolean>) ?? {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/saas/platform-config");
        if (!res.ok) throw new Error(t("superadmin.settings.failedToLoad"));
        const data = (await res.json()) as Config;
        if (cancelled) return;
        applyLoadedConfig(data);
      } catch {
        if (!cancelled) setMessage({ type: "error", text: t("superadmin.settings.failedToLoadConfig") });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [applyLoadedConfig, t]);

  const restoreFactoryDefault = async (field: "rateS80" | "rateS150" | "rateS200") => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/saas/platform-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing: { [field]: null } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(saasApiErrorMessageOr(err, t("superadmin.settings.saveFailed")));
      }
      const data = (await res.json()) as Config;
      applyLoadedConfig(data);
      setMessage({ type: "success", text: t("superadmin.settings.saved") });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : t("superadmin.settings.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const pricingFields: Array<[string, number | undefined | null]> = [
        ["defaultMarginMinPct", parseOptionalNumberField(marginMinPct)],
        ["defaultMarginMaxPct", parseOptionalNumberField(marginMaxPct)],
        ["defaultEntryFeeUsd", parseOptionalNumberField(entryFeeUsd)],
        ["defaultTrainingFeeUsd", parseOptionalNumberField(trainingFeeUsd)],
        ["visionLatamCommissionPct", parseOptionalNumberField(visionLatamCommissionPct)],
        ["rateS80", parseOptionalNumberField(rateS80)],
        ["rateS150", parseOptionalNumberField(rateS150)],
        ["rateS200", parseOptionalNumberField(rateS200)],
      ];
      if (pricingFields.some(([, v]) => v === null)) {
        setMessage({ type: "error", text: t("superadmin.settings.invalidNumber") });
        return;
      }

      const parsedMin = pricingFields.find(([k]) => k === "defaultMarginMinPct")![1] as number | undefined;
      const parsedMax = pricingFields.find(([k]) => k === "defaultMarginMaxPct")![1] as number | undefined;
      const effectiveMin = parsedMin ?? effectivePricing?.defaultMarginMinPct?.effective ?? null;
      const effectiveMax = parsedMax ?? effectivePricing?.defaultMarginMaxPct?.effective ?? null;
      if (
        effectiveMin != null &&
        effectiveMax != null &&
        Number.isFinite(effectiveMin) &&
        Number.isFinite(effectiveMax) &&
        effectiveMin > effectiveMax
      ) {
        setMessage({ type: "error", text: t("superadmin.settings.marginRangeInvalid") });
        return;
      }

      const body: Config = {
        pricing: Object.fromEntries(
          pricingFields.map(([key, value]) => [key, value === undefined ? undefined : value])
        ) as Config["pricing"],
        moduleVisibility: visibility,
      };
      const res = await fetch("/api/saas/platform-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(saasApiErrorMessageOr(err, t("superadmin.settings.saveFailed")));
      }
      const data = (await res.json()) as Config;
      applyLoadedConfig(data);
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
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-alert-successBorder bg-alert-success text-foreground"
              : "border-alert-errorBorder bg-alert-error text-foreground"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t("superadmin.settings.pricing")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.settings.pricingDescription")}</p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PricingNumericField
                label={t("superadmin.settings.minMarginLabel")}
                help={t("superadmin.settings.minMarginHelp")}
                meta={effectivePricing?.defaultMarginMinPct}
                editValue={marginMinPct}
                onEditChange={setMarginMinPct}
                step={0.5}
                max={100}
                suffix="%"
              />
              <PricingNumericField
                label={t("superadmin.settings.maxMarginLabel")}
                help={t("superadmin.settings.maxMarginHelp")}
                meta={effectivePricing?.defaultMarginMaxPct}
                editValue={marginMaxPct}
                onEditChange={setMarginMaxPct}
                step={0.5}
                max={100}
                suffix="%"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PricingNumericField
                label={t("superadmin.settings.entryFeeLabel")}
                meta={effectivePricing?.defaultEntryFeeUsd}
                editValue={entryFeeUsd}
                onEditChange={setEntryFeeUsd}
                suffix=" USD"
              />
              <PricingNumericField
                label={t("superadmin.settings.trainingFeeLabel")}
                meta={effectivePricing?.defaultTrainingFeeUsd}
                editValue={trainingFeeUsd}
                onEditChange={setTrainingFeeUsd}
                suffix=" USD"
              />
            </div>
            <PricingNumericField
              label={t("superadmin.settings.vlCommissionLabel")}
              help={t("superadmin.settings.vlCommissionHelp")}
              meta={effectivePricing?.visionLatamCommissionPct}
              editValue={visionLatamCommissionPct}
              onEditChange={setVisionLatamCommissionPct}
              step={0.5}
              max={100}
              suffix="%"
            />
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">{t("superadmin.settings.factoryRatesIntro")}</p>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <PricingNumericField
                  label={t("superadmin.settings.rateS80Label")}
                  meta={effectivePricing?.rateS80}
                  editValue={rateS80}
                  onEditChange={setRateS80}
                  onRestoreDefault={() => restoreFactoryDefault("rateS80")}
                  step={0.5}
                  suffix=" USD/m²"
                  stackEdit
                />
                <PricingNumericField
                  label={t("superadmin.settings.rateS150Label")}
                  meta={effectivePricing?.rateS150}
                  editValue={rateS150}
                  onEditChange={setRateS150}
                  onRestoreDefault={() => restoreFactoryDefault("rateS150")}
                  step={0.5}
                  suffix=" USD/m²"
                  stackEdit
                />
                <PricingNumericField
                  label={t("superadmin.settings.rateS200Label")}
                  meta={effectivePricing?.rateS200}
                  editValue={rateS200}
                  onEditChange={setRateS200}
                  onRestoreDefault={() => restoreFactoryDefault("rateS200")}
                  step={0.5}
                  suffix=" USD/m²"
                  stackEdit
                />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t("superadmin.settings.moduleVisibility")}</h2>
              <p className="text-sm text-muted-foreground">{t("superadmin.settings.moduleVisibilityHelp")}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {MODULE_KEYS.map(({ key, labelKey }) => (
              <label key={key} className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility[key] ?? true}
                  onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                  className="h-4 w-4 shrink-0 rounded-lg border-input"
                />
                <span className="truncate text-sm text-foreground">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="surface-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
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
              <div className="rounded-lg bg-primary/10 p-2">
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
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("superadmin.settings.save")}
        </button>
      </div>
    </div>
  );
}

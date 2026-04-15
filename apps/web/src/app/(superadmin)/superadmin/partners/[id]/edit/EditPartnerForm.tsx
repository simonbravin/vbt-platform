"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";
import { PartnerTerritoriesSection, type PartnerTerritoryRow } from "../PartnerTerritoriesSection";

const PARTNER_TYPES = [
  { value: "commercial_partner", labelKey: "superadmin.partners.commercialPartner" as const },
  { value: "master_partner", labelKey: "superadmin.partners.masterPartner" as const },
] as const;

const FEE_MODES = [
  { value: "fixed", labelKey: "superadmin.partner.engineeringFee.fixed" as const },
  { value: "percent", labelKey: "superadmin.partner.engineeringFee.percent" as const },
  { value: "per_request", labelKey: "superadmin.partner.engineeringFee.per_request" as const },
  { value: "included", labelKey: "superadmin.partner.engineeringFee.included" as const },
] as const;

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
] as const;

const SYSTEM_OPTIONS = [
  { value: "S80", labelKey: "admin.catalog.s80" },
  { value: "S150", labelKey: "admin.catalog.s150" },
  { value: "S200", labelKey: "admin.catalog.s200" },
] as const;

type Initial = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  website: string;
  country: string;
  partnerType: "commercial_partner" | "master_partner";
  engineeringFeeMode: string;
  status: string;
  visionLatamCommissionPct: string;
  visionLatamCommissionFixedUsd: string;
  moduleVisibility: Record<string, boolean> | null;
  enabledSystems: string[] | null;
  requireDeliveredEngineeringForQuotes: boolean;
};

export function EditPartnerForm({
  partnerId,
  initial,
  initialTerritories,
}: {
  partnerId: string;
  initial: Initial;
  initialTerritories: PartnerTerritoryRow[];
}) {
  const t = useT();
  const router = useRouter();
  const [territories, setTerritories] = useState<PartnerTerritoryRow[]>(initialTerritories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(
    () => initial.moduleVisibility ?? {
      dashboard: true,
      clients: true,
      engineering: true,
      projects: true,
      quotes: true,
      sales: true,
      inventory: true,
      documents: true,
      training: true,
      reports: true,
      settings: true,
    }
  );
  const [enabledSystems, setEnabledSystems] = useState<string[]>(
    () => initial.enabledSystems?.length ? [...initial.enabledSystems] : ["S80", "S150", "S200"]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSaving(true);
    try {
      const body = {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        website: form.website.trim() || null,
        country: form.country.trim() || null,
        partnerType: form.partnerType,
        engineeringFeeMode: form.engineeringFeeMode || null,
        status: form.status,
        visionLatamCommissionPct: form.visionLatamCommissionPct.trim() ? parseFloat(form.visionLatamCommissionPct) : null,
        visionLatamCommissionFixedUsd: form.visionLatamCommissionFixedUsd.trim() ? parseFloat(form.visionLatamCommissionFixedUsd) : null,
        moduleVisibility: visibility,
        enabledSystems: enabledSystems.length === 3 ? null : enabledSystems.length > 0 ? enabledSystems : null,
        requireDeliveredEngineeringForQuotes: form.requireDeliveredEngineeringForQuotes,
      };
      const res = await fetch(`/api/saas/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? data?.error ?? t("superadmin.partners.failedToUpdatePartner"));
        return;
      }
      setSuccessMessage(t("superadmin.partners.changesSaved"));
      setTimeout(() => {
        router.push(`/superadmin/partners/${partnerId}`);
        router.refresh();
      }, 1500);
    } catch {
      setError(t("superadmin.partners.failedToUpdatePartner"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
    <form
      onSubmit={handleSubmit}
      className="surface-card p-6 space-y-6"
    >
      {error && (
        <div className="rounded-lg border border-alert-errorBorder bg-alert-error px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-alert-successBorder bg-alert-success px-4 py-3 text-sm text-foreground">
          {successMessage}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="companyName" className="block text-sm font-medium text-foreground">
            {t("superadmin.partners.fieldCompanyName")}
          </label>
          <input
            id="companyName"
            type="text"
            required
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="input-native mt-1"
          />
        </div>
        <div>
          <label htmlFor="contactName" className="block text-sm font-medium text-foreground">
            {t("superadmin.partners.fieldContactName")}
          </label>
          <input
            id="contactName"
            type="text"
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className="input-native mt-1"
          />
        </div>
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-foreground">
            {t("superadmin.partners.fieldContactEmail")}
          </label>
          <input
            id="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            className="input-native mt-1"
          />
        </div>
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-foreground">
            {t("superadmin.partners.fieldWebsite")}
          </label>
          <input
            id="website"
            type="url"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="input-native mt-1"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-foreground">
            {t("superadmin.partner.edit.countryCode")}
          </label>
          <input
            id="country"
            type="text"
            maxLength={2}
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
            className="input-native mt-1"
          />
        </div>
        <div>
          <label htmlFor="partnerType" className="block text-sm font-medium text-foreground">
            {t("superadmin.partner.edit.partnerType")}
          </label>
          <FilterSelect
            value={form.partnerType}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, partnerType: v as "commercial_partner" | "master_partner" }))
            }
            options={PARTNER_TYPES.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            aria-label={t("superadmin.partner.edit.partnerType")}
            triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
          />
        </div>
        <div>
          <label htmlFor="engineeringFeeMode" className="block text-sm font-medium text-foreground">
            {t("superadmin.partner.edit.engineeringFeeMode")}
          </label>
          <FilterSelect
            value={form.engineeringFeeMode}
            onValueChange={(v) => setForm((f) => ({ ...f, engineeringFeeMode: v }))}
            emptyOptionLabel="—"
            options={FEE_MODES.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            aria-label={t("superadmin.partner.edit.engineeringFeeMode")}
            triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/30/80 px-4 py-3">
            <input
              type="checkbox"
              checked={form.requireDeliveredEngineeringForQuotes}
              onChange={(e) => setForm((f) => ({ ...f, requireDeliveredEngineeringForQuotes: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded-lg border-input"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">{t("superadmin.partner.requireDeliveredEngineeringQuotes")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t("superadmin.partner.requireDeliveredEngineeringQuotesHelp")}</span>
            </span>
          </label>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-foreground">
            {t("superadmin.partner.edit.accountStatus")}
          </label>
          <FilterSelect
            value={form.status}
            onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
            options={[
              { value: "active", label: t("admin.users.statusActive") },
              { value: "suspended", label: t("admin.users.statusSuspended") },
              { value: "pending", label: t("admin.users.statusPending") },
            ]}
            aria-label={t("superadmin.partner.edit.accountStatus")}
            triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
          />
        </div>
        <div>
          <label htmlFor="visionLatamCommissionPct" className="block text-sm font-medium text-foreground">
            {t("superadmin.partner.commissionPctFieldLabel")}
          </label>
          <input
            id="visionLatamCommissionPct"
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder={t("superadmin.partner.commissionPctPlaceholder")}
            value={form.visionLatamCommissionPct}
            onChange={(e) => setForm((f) => ({ ...f, visionLatamCommissionPct: e.target.value }))}
            className="input-native mt-1"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">{t("superadmin.partner.commissionPctHelp")}</p>
        </div>
        <div>
          <label htmlFor="visionLatamCommissionFixedUsd" className="block text-sm font-medium text-foreground">
            {t("superadmin.partner.commissionFixedFieldLabel")}
          </label>
          <input
            id="visionLatamCommissionFixedUsd"
            type="number"
            min={0}
            step={0.01}
            placeholder={t("admin.inventory.optional")}
            value={form.visionLatamCommissionFixedUsd}
            onChange={(e) => setForm((f) => ({ ...f, visionLatamCommissionFixedUsd: e.target.value }))}
            className="input-native mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partner.moduleVisibilityTitle")}</h4>
          <p className="text-xs text-muted-foreground mb-2">{t("superadmin.partner.moduleVisibilityHelp")}</p>
          <div className="flex flex-wrap gap-4">
            {MODULE_KEYS.map(({ key, labelKey }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility[key] ?? true}
                  onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded-lg border-input"
                />
                <span className="text-sm text-foreground">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partner.enabledSystemsTitle")}</h4>
          <p className="text-xs text-muted-foreground mb-2">{t("superadmin.partner.enabledSystemsHelp")}</p>
          <div className="flex flex-wrap gap-4">
            {SYSTEM_OPTIONS.map(({ value, labelKey }) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabledSystems.includes(value)}
                  onChange={(e) => {
                    if (e.target.checked) setEnabledSystems((s) => (s.includes(value) ? s : [...s, value]));
                    else setEnabledSystems((s) => s.filter((x) => x !== value));
                  }}
                  className="h-4 w-4 rounded-lg border-input"
                />
                <span className="text-sm text-foreground">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("common.saveChanges")}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/superadmin/partners/${partnerId}`)}
          className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
    <PartnerTerritoriesSection
      partnerId={partnerId}
      territories={territories}
      setTerritories={setTerritories}
      onUpdate={() => router.refresh()}
    />
    </div>
  );
}

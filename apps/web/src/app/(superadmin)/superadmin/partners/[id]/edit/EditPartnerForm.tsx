"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";

const PARTNER_TYPES = [
  { value: "commercial_partner", label: "Commercial partner" },
  { value: "master_partner", label: "Master partner" },
] as const;

const FEE_MODES = [
  { value: "fixed", label: "Fixed" },
  { value: "percent", label: "Percent" },
  { value: "per_request", label: "Per request" },
  { value: "included", label: "Included" },
] as const;

const MODULE_KEYS = [
  { key: "engineering", labelKey: "superadmin.settings.engineering" },
  { key: "documents", labelKey: "superadmin.settings.documents" },
  { key: "training", labelKey: "superadmin.settings.training" },
  { key: "reports", labelKey: "superadmin.settings.reports" },
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
};

export function EditPartnerForm({
  partnerId,
  initial,
}: {
  partnerId: string;
  initial: Initial;
}) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(
    () => initial.moduleVisibility ?? { engineering: true, documents: true, training: true, reports: true }
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
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6 max-w-2xl"
    >
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
            Company name *
          </label>
          <input
            id="companyName"
            type="text"
            required
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">
            Contact name
          </label>
          <input
            id="contactName"
            type="text"
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
            Contact email
          </label>
          <input
            id="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Country (code)
          </label>
          <input
            id="country"
            type="text"
            maxLength={2}
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
        </div>
        <div>
          <label htmlFor="partnerType" className="block text-sm font-medium text-gray-700">
            Partner type *
          </label>
          <select
            id="partnerType"
            required
            value={form.partnerType}
            onChange={(e) =>
              setForm((f) => ({ ...f, partnerType: e.target.value as "commercial_partner" | "master_partner" }))
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          >
            {PARTNER_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="engineeringFeeMode" className="block text-sm font-medium text-gray-700">
            Engineering fee mode
          </label>
          <select
            id="engineeringFeeMode"
            value={form.engineeringFeeMode}
            onChange={(e) => setForm((f) => ({ ...f, engineeringFeeMode: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          >
            <option value="">—</option>
            {FEE_MODES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div>
          <label htmlFor="visionLatamCommissionPct" className="block text-sm font-medium text-gray-700">
            Comisión Vision Latam (% sobre factory cost)
          </label>
          <input
            id="visionLatamCommissionPct"
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder="Ej. 20 → el partner ve base = factory × 1.20"
            value={form.visionLatamCommissionPct}
            onChange={(e) => setForm((f) => ({ ...f, visionLatamCommissionPct: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
          <p className="mt-0.5 text-xs text-gray-500">
            % que Vision Latam cobra sobre el costo de fábrica. El partner nunca ve el factory cost ni este %; solo ve el precio base = factory × (1 + %/100). Ej: 20% y $67/m² → el partner ve $80.40/m² como base. Vacío = usar valor global.
          </p>
        </div>
        <div>
          <label htmlFor="visionLatamCommissionFixedUsd" className="block text-sm font-medium text-gray-700">
            Comisión Vision Latam fija (USD, opcional)
          </label>
          <input
            id="visionLatamCommissionFixedUsd"
            type="number"
            min={0}
            step={0.01}
            placeholder="Optional"
            value={form.visionLatamCommissionFixedUsd}
            onChange={(e) => setForm((f) => ({ ...f, visionLatamCommissionFixedUsd: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
          />
        </div>
        <div className="sm:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Visibilidad de módulos (override por partner)</h4>
          <p className="text-xs text-gray-500 mb-2">Qué módulos ve este partner. Si no se define, se usa la configuración global.</p>
          <div className="flex flex-wrap gap-4">
            {MODULE_KEYS.map(({ key, labelKey }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility[key] ?? true}
                  onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Sistemas de panel habilitados (80mm, 150mm, 200mm)</h4>
          <p className="text-xs text-gray-500 mb-2">Qué sistemas puede usar este partner en cotizaciones e inventario. Solo verá piezas del catálogo de los sistemas marcados.</p>
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
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-vbt-blue/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/superadmin/partners/${partnerId}`)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

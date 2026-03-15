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

type Initial = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  website: string;
  country: string;
  partnerType: "commercial_partner" | "master_partner";
  engineeringFeeMode: string;
  status: string;
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
  const [form, setForm] = useState(initial);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      router.push(`/superadmin/partners/${partnerId}`);
      router.refresh();
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

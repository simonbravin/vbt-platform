"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

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

export function CreatePartnerForm() {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    companyName: string;
    contactName: string;
    contactEmail: string;
    website: string;
    country: string;
    partnerType: "commercial_partner" | "master_partner";
    engineeringFeeMode: string;
    status: string;
    sendInvite: boolean;
  }>({
    companyName: "",
    contactName: "",
    contactEmail: "",
    website: "",
    country: "",
    partnerType: "commercial_partner",
    engineeringFeeMode: "",
    status: "active",
    sendInvite: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const contactEmailTrimmed = form.contactEmail.trim() || null;
      const body = {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim() || null,
        contactEmail: contactEmailTrimmed,
        website: form.website.trim() || null,
        country: form.country.trim() || null,
        partnerType: form.partnerType,
        engineeringFeeMode: form.engineeringFeeMode || null,
        status: form.status,
      };
      const res = await fetch("/api/saas/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? data?.error ?? t("superadmin.partners.failedToCreate"));
        return;
      }
      if (form.sendInvite && contactEmailTrimmed) {
        try {
          const inviteRes = await fetch(`/api/saas/partners/${data.id}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: contactEmailTrimmed, role: "owner" }),
          });
          if (inviteRes.ok) {
            const inviteData = await inviteRes.json();
            if (inviteData.pendingInvite) {
              router.push(`/superadmin/partners/${data.id}?inviteSent=new`);
            } else {
              router.push(`/superadmin/partners/${data.id}?inviteSent=existing`);
            }
            router.refresh();
            return;
          }
        } catch {
          // Partner was created; invite failed. Still go to detail.
        }
      }
      router.push(`/superadmin/partners/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(t("superadmin.partners.failedToCreate"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card p-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-alert-errorBorder bg-alert-error px-4 py-3 text-sm text-foreground">
          {error}
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
            placeholder={t("superadmin.partners.websitePlaceholder")}
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
            placeholder={t("superadmin.partners.countryCodePlaceholder")}
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
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30/50 p-4">
        <input
          id="sendInvite"
          type="checkbox"
          checked={form.sendInvite}
          onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
          className="h-4 w-4 rounded-lg border-input text-primary focus-visible:ring-ring"
        />
        <label htmlFor="sendInvite" className="text-sm font-medium text-foreground">
          {t("superadmin.partners.sendInviteLabel")}
        </label>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        {t("superadmin.partners.sendInviteHelp")}
      </p>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !form.companyName.trim()}
          className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("superadmin.partners.creating") : t("superadmin.partners.createPartner")}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

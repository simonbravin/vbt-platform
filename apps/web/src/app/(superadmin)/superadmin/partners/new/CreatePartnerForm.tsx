"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

const SYSTEM_OPTIONS = [
  { value: "S80", labelKey: "admin.catalog.s80" },
  { value: "S150", labelKey: "admin.catalog.s150" },
  { value: "S200", labelKey: "admin.catalog.s200" },
] as const;

type CountryOption = { id: string; code: string; name: string };

export function CreatePartnerForm({ initialCountry }: { initialCountry?: string }) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryReady, setCountryReady] = useState<boolean | null>(null);
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
    territoryType: "exclusive" | "open" | "referral";
    enabledSystems: string[];
  }>({
    companyName: "",
    contactName: "",
    contactEmail: "",
    website: "",
    country: (initialCountry ?? "").trim().toUpperCase().slice(0, 2),
    partnerType: "commercial_partner",
    engineeringFeeMode: "",
    status: "active",
    sendInvite: true,
    territoryType: "open",
    enabledSystems: ["S80", "S150", "S200"],
  });

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCountries(Array.isArray(d) ? d : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const code = form.country.trim().toUpperCase();
    if (code.length !== 2 || countries.length === 0) {
      setCountryReady(null);
      return;
    }
    const country = countries.find((c) => c.code.toUpperCase() === code);
    if (!country) {
      setCountryReady(false);
      return;
    }
    let cancelled = false;
    Promise.all([fetch("/api/tax-rules"), fetch("/api/freight")])
      .then(async ([tRes, fRes]) => {
        const [taxes, freight] = await Promise.all([tRes.json(), fRes.json()]);
        const taxOk =
          Array.isArray(taxes) &&
          taxes.some(
            (s: { countryId?: string; rules?: { label?: string }[] }) =>
              s.countryId === country.id &&
              Array.isArray(s.rules) &&
              s.rules.some((r) => (r.label ?? "").trim().length > 0)
          );
        const freightOk =
          Array.isArray(freight) && freight.some((p: { countryId?: string }) => p.countryId === country.id);
        if (!cancelled) setCountryReady(taxOk && freightOk);
      })
      .catch(() => {
        if (!cancelled) setCountryReady(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.country, countries]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const contactEmailTrimmed = form.contactEmail.trim() || null;
      const country = form.country.trim().toUpperCase() || null;
      const body = {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim() || null,
        contactEmail: contactEmailTrimmed,
        website: form.website.trim() || null,
        country,
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

      const partnerId = data.id as string;
      let setupIncomplete = false;

      if (form.enabledSystems.length > 0 && form.enabledSystems.length < 3) {
        try {
          const sysRes = await fetch(`/api/saas/partners/${partnerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabledSystems: form.enabledSystems }),
          });
          if (!sysRes.ok) setupIncomplete = true;
        } catch {
          setupIncomplete = true;
        }
      }

      if (country && country.length === 2) {
        try {
          const terrRes = await fetch(`/api/saas/partners/${partnerId}/territories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              countryCode: country,
              territoryType: form.territoryType,
              exclusive: form.territoryType === "exclusive",
            }),
          });
          if (!terrRes.ok) setupIncomplete = true;
        } catch {
          setupIncomplete = true;
        }
      }

      try {
        const onboardRes = await fetch(`/api/saas/partners/${partnerId}/onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: "application_received" }),
        });
        if (!onboardRes.ok) setupIncomplete = true;
      } catch {
        setupIncomplete = true;
      }

      const setupQuery = setupIncomplete ? "setupIncomplete=1" : "";

      if (form.sendInvite && contactEmailTrimmed) {
        try {
          const inviteRes = await fetch(`/api/saas/partners/${partnerId}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: contactEmailTrimmed, role: "owner" }),
          });
          if (inviteRes.ok) {
            const inviteData = await inviteRes.json();
            const inviteQ = inviteData.pendingInvite ? "inviteSent=new" : "inviteSent=existing";
            router.push(`/superadmin/partners/${partnerId}?${inviteQ}${setupQuery ? `&${setupQuery}` : ""}`);
            router.refresh();
            return;
          }
        } catch {
          // Partner was created; invite failed. Still go to detail.
        }
      }
      router.push(`/superadmin/partners/${partnerId}${setupQuery ? `?${setupQuery}` : ""}`);
      router.refresh();
    } catch {
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
      <p className="text-sm text-muted-foreground">{t("superadmin.partners.createPlaybookHelp")}</p>
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
            {t("superadmin.partners.fieldCountry")}
          </label>
          {countries.length > 0 ? (
            <FilterSelect
              value={form.country}
              onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
              emptyOptionLabel={t("superadmin.partners.selectCountry")}
              options={[
                ...(form.country && !countries.some((c) => c.code === form.country)
                  ? [{ value: form.country, label: form.country }]
                  : []),
                ...countries.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` })),
              ]}
              aria-label={t("superadmin.partners.fieldCountry")}
              triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
            />
          ) : (
            <input
              id="country"
              type="text"
              maxLength={2}
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
              placeholder={t("superadmin.partners.countryCodePlaceholder")}
              className="input-native mt-1"
            />
          )}
          {countryReady === false ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("superadmin.partners.countryNotReady")}{" "}
              <Link href="/superadmin/countries/onboard" className="text-primary hover:underline">
                {t("superadmin.partners.openCountryPlaybook")}
              </Link>
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="territoryType" className="block text-sm font-medium text-foreground">
            {t("superadmin.partners.territoryType")}
          </label>
          <FilterSelect
            value={form.territoryType}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, territoryType: v as "exclusive" | "open" | "referral" }))
            }
            options={[
              { value: "open", label: t("superadmin.partner.territoryType.open") },
              { value: "exclusive", label: t("superadmin.partner.territoryType.exclusive") },
              { value: "referral", label: t("superadmin.partner.territoryType.referral") },
            ]}
            aria-label={t("superadmin.partners.territoryType")}
            triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">{t("superadmin.partners.territoryHelp")}</p>
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
        <div className="sm:col-span-2">
          <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partners.systemsTitle")}</h4>
          <p className="text-xs text-muted-foreground mb-2">{t("superadmin.partners.systemsHelp")}</p>
          <div className="flex flex-wrap gap-4">
            {SYSTEM_OPTIONS.map(({ value, labelKey }) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enabledSystems.includes(value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setForm((f) => ({
                        ...f,
                        enabledSystems: f.enabledSystems.includes(value)
                          ? f.enabledSystems
                          : [...f.enabledSystems, value],
                      }));
                    } else {
                      setForm((f) => ({
                        ...f,
                        enabledSystems: f.enabledSystems.filter((x) => x !== value),
                      }));
                    }
                  }}
                  className="h-4 w-4 rounded-lg border-input"
                />
                <span className="text-sm text-foreground">{t(labelKey)}</span>
              </label>
            ))}
          </div>
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
          disabled={saving || !form.companyName.trim() || form.enabledSystems.length === 0}
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

type Country = { id: string; code: string; name: string; currency?: string | null };
type TaxRule = { label?: string; ratePct?: number; fixedAmount?: number };
type TaxSet = { id: string; name: string; countryId: string; rules?: TaxRule[] };
type Freight = { id: string; name: string; countryId: string; freightPerContainer?: number };

function taxReady(sets: TaxSet[], countryId: string) {
  return sets.some(
    (s) =>
      s.countryId === countryId &&
      Array.isArray(s.rules) &&
      s.rules.some((r) => {
        const hasLabel = (r.label ?? "").trim().length > 0;
        const hasRate = typeof r.ratePct === "number" && Number.isFinite(r.ratePct);
        const hasFixed = typeof r.fixedAmount === "number" && Number.isFinite(r.fixedAmount);
        return hasLabel && (hasRate || hasFixed);
      })
  );
}

function freightReady(profiles: Freight[], countryId: string) {
  return profiles.some((p) => p.countryId === countryId);
}

export function CountryOnboardClient() {
  const t = useT();
  const [countries, setCountries] = useState<Country[]>([]);
  const [taxSets, setTaxSets] = useState<TaxSet[]>([]);
  const [freight, setFreight] = useState<Freight[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newCountry, setNewCountry] = useState({ code: "", name: "", currency: "USD" });
  const [creatingCountry, setCreatingCountry] = useState(false);

  const [taxForm, setTaxForm] = useState({ name: "", label: "", ratePct: "" });
  const [savingTax, setSavingTax] = useState(false);

  const [freightForm, setFreightForm] = useState({ name: "", freightPerContainer: "" });
  const [savingFreight, setSavingFreight] = useState(false);

  const load = useCallback(async () => {
    const [cRes, tRes, fRes] = await Promise.all([
      fetch("/api/countries"),
      fetch("/api/tax-rules"),
      fetch("/api/freight"),
    ]);
    const [cData, tData, fData] = await Promise.all([cRes.json(), tRes.json(), fRes.json()]);
    setCountries(Array.isArray(cData) ? cData : []);
    setTaxSets(Array.isArray(tData) ? tData : []);
    setFreight(Array.isArray(fData) ? fData : []);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const selected = useMemo(
    () => countries.find((c) => c.id === selectedId) ?? null,
    [countries, selectedId]
  );
  const hasTax = selected ? taxReady(taxSets, selected.id) : false;
  const hasFreight = selected ? freightReady(freight, selected.id) : false;
  const ready = Boolean(selected && hasTax && hasFreight);
  const countryTaxSets = selected ? taxSets.filter((s) => s.countryId === selected.id) : [];
  const countryFreight = selected ? freight.filter((p) => p.countryId === selected.id) : [];

  async function handleCreateCountry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingCountry(true);
    try {
      const res = await fetch("/api/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCountry.code.trim().toUpperCase(),
          name: newCountry.name.trim(),
          currency: newCountry.currency.trim() || "USD",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("superadmin.countryOnboard.failedCountry"));
        return;
      }
      setNewCountry({ code: "", name: "", currency: "USD" });
      await load();
      if (data?.id) setSelectedId(data.id);
    } catch {
      setError(t("superadmin.countryOnboard.failedCountry"));
    } finally {
      setCreatingCountry(false);
    }
  }

  async function handleCreateTax(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const rate = Number(taxForm.ratePct);
    if (!taxForm.name.trim() || !taxForm.label.trim() || taxForm.ratePct.trim() === "" || Number.isNaN(rate)) {
      setError(t("superadmin.countryOnboard.taxNeedRate"));
      return;
    }
    setError(null);
    setSavingTax(true);
    try {
      const res = await fetch("/api/tax-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: taxForm.name.trim(),
          countryId: selected.id,
          organizationId: null,
          rules: [{ order: 1, label: taxForm.label.trim(), base: "CIF", ratePct: rate }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("superadmin.countryOnboard.failedTax"));
        return;
      }
      setTaxForm({ name: "", label: "", ratePct: "" });
      await load();
    } catch {
      setError(t("superadmin.countryOnboard.failedTax"));
    } finally {
      setSavingTax(false);
    }
  }

  async function handleCreateFreight(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(freightForm.freightPerContainer);
    if (!freightForm.name.trim() || freightForm.freightPerContainer.trim() === "" || Number.isNaN(amount) || amount < 0) {
      setError(t("superadmin.countryOnboard.freightNeedAmount"));
      return;
    }
    setError(null);
    setSavingFreight(true);
    try {
      const res = await fetch("/api/freight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: freightForm.name.trim(),
          countryId: selected.id,
          freightPerContainer: amount,
          isDefault: true,
          organizationId: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("superadmin.countryOnboard.failedFreight"));
        return;
      }
      setFreightForm({ name: "", freightPerContainer: "" });
      await load();
    } catch {
      setError(t("superadmin.countryOnboard.failedFreight"));
    } finally {
      setSavingFreight(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-alert-errorBorder bg-alert-error px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}

      <section className="surface-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <StepMark done={Boolean(selected)} current={!selected} n={1} />
          <h2 className="text-sm font-semibold text-foreground">{t("superadmin.countryOnboard.stepCountry")}</h2>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t("superadmin.countryOnboard.selectCountry")}</label>
          <FilterSelect
            value={selectedId}
            onValueChange={setSelectedId}
            emptyOptionLabel={t("superadmin.countryOnboard.noCountryYet")}
            options={countries.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.code})`,
            }))}
            aria-label={t("superadmin.countryOnboard.selectCountry")}
            triggerClassName="mt-1 h-10 w-full max-w-md min-w-0 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("superadmin.countryOnboard.orCreate")}</p>
        <form onSubmit={handleCreateCountry} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="iso" className="block text-sm font-medium text-foreground">
              {t("admin.countries.code")}
            </label>
            <input
              id="iso"
              type="text"
              maxLength={2}
              required
              value={newCountry.code}
              onChange={(e) => setNewCountry((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder={t("admin.countries.codePlaceholder")}
              className="input-native mt-1"
            />
          </div>
          <div>
            <label htmlFor="cname" className="block text-sm font-medium text-foreground">
              {t("admin.countries.countryName")}
            </label>
            <input
              id="cname"
              type="text"
              required
              value={newCountry.name}
              onChange={(e) => setNewCountry((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("admin.countries.namePlaceholder")}
              className="input-native mt-1"
            />
          </div>
          <div>
            <label htmlFor="ccy" className="block text-sm font-medium text-foreground">
              {t("superadmin.countryOnboard.currency")}
            </label>
            <input
              id="ccy"
              type="text"
              maxLength={3}
              value={newCountry.currency}
              onChange={(e) => setNewCountry((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
              placeholder={t("superadmin.countryOnboard.currencyPlaceholder")}
              className="input-native mt-1"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={creatingCountry || !newCountry.code.trim() || !newCountry.name.trim()}
              className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {creatingCountry ? t("superadmin.countryOnboard.creatingCountry") : t("superadmin.countryOnboard.createCountry")}
            </button>
          </div>
        </form>
      </section>

      <section className={`surface-card space-y-4 p-6 ${selected ? "" : "opacity-60"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StepMark done={hasTax} current={Boolean(selected) && !hasTax} n={2} />
            <h2 className="text-sm font-semibold text-foreground">{t("superadmin.countryOnboard.stepTax")}</h2>
          </div>
          <Link href="/superadmin/admin/taxes" className="text-sm text-primary hover:underline">
            {t("superadmin.countryOnboard.openTaxes")}
          </Link>
        </div>
        {!selected ? (
          <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.noCountryYet")}</p>
        ) : hasTax ? (
          <p className="text-sm text-foreground">
            {t("superadmin.countryOnboard.taxPresent", { count: String(countryTaxSets.length) })}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.taxHelp")}</p>
            <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.taxMissing")}</p>
            <form onSubmit={handleCreateTax} className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-foreground">{t("superadmin.countryOnboard.taxSetName")}</label>
                <input
                  type="text"
                  required
                  value={taxForm.name}
                  onChange={(e) => setTaxForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-native mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{t("superadmin.countryOnboard.taxRuleLabel")}</label>
                <input
                  type="text"
                  required
                  value={taxForm.label}
                  onChange={(e) => setTaxForm((f) => ({ ...f, label: e.target.value }))}
                  className="input-native mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{t("superadmin.countryOnboard.taxRuleRate")}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={taxForm.ratePct}
                  onChange={(e) => setTaxForm((f) => ({ ...f, ratePct: e.target.value }))}
                  className="input-native mt-1"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={savingTax}
                  className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t("superadmin.countryOnboard.taxAddSet")}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className={`surface-card space-y-4 p-6 ${selected ? "" : "opacity-60"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StepMark done={hasFreight} current={Boolean(selected) && hasTax && !hasFreight} n={3} />
            <h2 className="text-sm font-semibold text-foreground">{t("superadmin.countryOnboard.stepFreight")}</h2>
          </div>
          <Link href="/superadmin/admin/freight" className="text-sm text-primary hover:underline">
            {t("superadmin.countryOnboard.openFreight")}
          </Link>
        </div>
        {!selected ? (
          <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.noCountryYet")}</p>
        ) : hasFreight ? (
          <p className="text-sm text-foreground">
            {t("superadmin.countryOnboard.freightPresent", { count: String(countryFreight.length) })}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.freightHelp")}</p>
            <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.freightMissing")}</p>
            <form onSubmit={handleCreateFreight} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground">{t("superadmin.countryOnboard.freightName")}</label>
                <input
                  type="text"
                  required
                  value={freightForm.name}
                  onChange={(e) => setFreightForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-native mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  {t("superadmin.countryOnboard.freightPerContainer")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={freightForm.freightPerContainer}
                  onChange={(e) => setFreightForm((f) => ({ ...f, freightPerContainer: e.target.value }))}
                  className="input-native mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingFreight}
                  className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t("superadmin.countryOnboard.freightAdd")}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className="surface-card space-y-3 p-6">
        <div className="flex items-center gap-2">
          <StepMark done={ready} current={Boolean(selected) && hasTax && hasFreight} n={4} />
          <h2 className="text-sm font-semibold text-foreground">{t("superadmin.countryOnboard.stepReady")}</h2>
        </div>
        {ready && selected ? (
          <>
            <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.readyHelp")}</p>
            <Link
              href={`/superadmin/partners/new?country=${encodeURIComponent(selected.code)}`}
              className="inline-flex rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("superadmin.countryOnboard.createPartner")}
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("superadmin.countryOnboard.blocked")}</p>
        )}
      </section>
    </div>
  );
}

function StepMark({ done, current, n }: { done: boolean; current: boolean; n: number }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
        done || current
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground"
      }`}
      aria-hidden
    >
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );
}

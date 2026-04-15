"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterSelect } from "@/components/ui/filter-select";

export type PartnerTerritoryRow = {
  id: string;
  countryCode: string;
  region?: string | null;
  territoryType: string;
};

function territoryTypeDisplay(t: (key: string) => string, territoryType: string): string {
  const key = `superadmin.partner.territoryType.${territoryType}`;
  const out = t(key);
  return out === key ? territoryType : out;
}

export function PartnerTerritoriesSection({
  partnerId,
  territories,
  onUpdate,
  setTerritories,
}: {
  partnerId: string;
  territories: PartnerTerritoryRow[];
  onUpdate: () => void;
  setTerritories: (rows: PartnerTerritoryRow[]) => void;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [region, setRegion] = useState("");
  const [territoryType, setTerritoryType] = useState<"exclusive" | "open" | "referral">("open");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [removeTerritoryId, setRemoveTerritoryId] = useState<string | null>(null);
  const [removingTerritory, setRemovingTerritory] = useState(false);

  async function handleAdd() {
    if (!countryCode.trim() || countryCode.length !== 2) {
      setErr(t("superadmin.partner.countryCodeTwoChars"));
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/saas/partners/${partnerId}/territories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: countryCode.trim().toUpperCase(),
          region: region.trim() || null,
          territoryType,
          exclusive: territoryType === "exclusive",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error?.message ?? t("superadmin.partners.failedToAddTerritory"));
        return;
      }
      setTerritories([...territories, data]);
      setCountryCode("");
      setRegion("");
      setAdding(false);
      onUpdate();
    } catch {
      setErr(t("superadmin.partners.failedToAddTerritory"));
    } finally {
      setSubmitting(false);
    }
  }

  async function doRemoveTerritory(territoryId: string) {
    try {
      const res = await fetch(`/api/saas/territories/${territoryId}`, { method: "DELETE" });
      if (!res.ok) return;
      setTerritories(territories.filter((row) => row.id !== territoryId));
      setRemoveTerritoryId(null);
      onUpdate();
    } catch {
      // ignore
    } finally {
      setRemovingTerritory(false);
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTerritoryId) return;
    setRemovingTerritory(true);
    await doRemoveTerritory(removeTerritoryId);
  }

  return (
    <div className="surface-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">{t("superadmin.partner.detail.territories")}</h3>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {t("superadmin.partner.addTerritory")}
          </button>
        ) : null}
      </div>

      {adding && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.countryCode")}</label>
              <input
                type="text"
                maxLength={2}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                className="mt-1 block w-20 rounded-lg border border-input px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.region")}</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 block w-32 rounded-lg border border-input px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.territoryType")}</label>
              <FilterSelect
                value={territoryType}
                onValueChange={(v) => setTerritoryType(v as "exclusive" | "open" | "referral")}
                options={[
                  { value: "exclusive", label: t("superadmin.partner.territoryType.exclusive") },
                  { value: "open", label: t("superadmin.partner.territoryType.open") },
                  { value: "referral", label: t("superadmin.partner.territoryType.referral") },
                ]}
                aria-label={t("superadmin.partner.detail.territoryType")}
                triggerClassName="mt-1 h-9 min-w-[9rem] max-w-full text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={submitting}
              className="rounded-lg border border-primary/20 bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t("superadmin.partner.adding") : t("superadmin.partner.add")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setErr(null);
              }}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {territories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("superadmin.partner.detail.noTerritoriesYet")}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {territories.map((territory) => (
            <li key={territory.id} className="py-3 flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium">{territory.countryCode}</span>
              {territory.region && <span className="text-muted-foreground">{territory.region}</span>}
              <span className="text-xs rounded-lg bg-muted px-2 py-0.5">{territoryTypeDisplay(t, territory.territoryType)}</span>
              <button
                type="button"
                onClick={() => setRemoveTerritoryId(territory.id)}
                className="text-sm text-destructive hover:underline ml-auto"
              >
                {t("superadmin.partner.removeTerritory")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removeTerritoryId}
        onOpenChange={(open) => !open && setRemoveTerritoryId(null)}
        title={t("superadmin.partners.removeTerritoryConfirmTitle")}
        description={t("superadmin.partners.removeTerritoryConfirmMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("superadmin.partners.removing")}
        variant="danger"
        loading={removingTerritory}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  );
}

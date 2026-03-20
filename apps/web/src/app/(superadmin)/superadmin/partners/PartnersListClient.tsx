"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, MapPin, Mail } from "lucide-react";
import { useT } from "@/lib/i18n/context";

function partnerTypeListLabel(t: (key: string) => string, partnerType: string | null | undefined): string {
  if (!partnerType) return "—";
  if (partnerType === "commercial_partner") return t("superadmin.partners.commercialPartner");
  if (partnerType === "master_partner") return t("superadmin.partners.masterPartner");
  return partnerType.replace(/_/g, " ");
}

function onboardingListLabel(t: (key: string) => string, state: string | null | undefined): string {
  if (!state) return "—";
  const key = `superadmin.partner.onboarding.${state}`;
  const out = t(key);
  return out === key ? state.replace(/_/g, " ") : out;
}

function organizationStatusListLabel(t: (key: string) => string, status: string | null | undefined): string {
  if (!status) return "—";
  if (status === "active") return t("admin.users.statusActive");
  if (status === "suspended") return t("admin.users.statusSuspended");
  if (status === "pending") return t("admin.users.statusPending");
  return status;
}

type Partner = {
  id: string;
  name: string;
  status?: string | null;
  countryCode?: string | null;
  website?: string | null;
  partnerProfile?: {
    partnerType: string;
    contactName?: string | null;
    contactEmail?: string | null;
    onboardingState?: string | null;
  } | null;
};

export function PartnersListClient() {
  const t = useT();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPartners() {
      try {
        const res = await fetch("/api/saas/partners?limit=100");
        if (!res.ok) {
          setError(t("superadmin.partners.failedToLoad"));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setPartners(data.partners ?? []);
          setTotal(data.total ?? 0);
        }
      } catch {
        if (!cancelled) setError(t("superadmin.partners.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPartners();
    return () => { cancelled = true; };
  }, [t]);

  if (error) {
    return (
      <div className="rounded-xl border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {total} {total !== 1 ? t("superadmin.partners.countPlural") : t("superadmin.partners.count")}
        </p>
        <Link
          href="/superadmin/partners/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("superadmin.partners.newPartner")}
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.partners.loading")}</div>
        ) : partners.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.partners.noPartnersYet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.partners.emptyStateHint")}</p>
            <Link
              href="/superadmin/partners/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("superadmin.partners.newPartner")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.partners.listColPartner")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.partners.listColType")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.partners.listColContact")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.partners.listColOnboarding")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.partners.listColStatus")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("superadmin.partners.listColActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/superadmin/partners/${p.id}`}
                        className="font-medium text-foreground hover:text-primary flex items-center gap-2"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {p.name}
                      </Link>
                      {p.countryCode && (
                        <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.countryCode}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {partnerTypeListLabel(t, p.partnerProfile?.partnerType)}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {p.partnerProfile?.contactName ?? p.partnerProfile?.contactEmail ?? "—"}
                      {p.partnerProfile?.contactEmail && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {p.partnerProfile.contactEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {onboardingListLabel(t, p.partnerProfile?.onboardingState)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.status === "active"
                            ? "bg-muted text-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {organizationStatusListLabel(t, p.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/superadmin/partners/${p.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t("superadmin.partners.manage")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, MapPin, Mail, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ViewLayoutToggle } from "@/components/ui/view-layout-toggle";

const SEARCH_DEBOUNCE_MS = 350;
const VIEW_STORAGE_KEY = "vbt-superadmin-partners-view";
const FETCH_LIMIT = 500;

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

function partnerSearchHaystack(
  p: Partner,
  t: (key: string) => string
): string {
  return [
    p.name,
    p.countryCode ?? "",
    p.website ?? "",
    p.partnerProfile?.partnerType ?? "",
    p.partnerProfile?.contactName ?? "",
    p.partnerProfile?.contactEmail ?? "",
    p.partnerProfile?.onboardingState ?? "",
    p.status ?? "",
    partnerTypeListLabel(t, p.partnerProfile?.partnerType),
    onboardingListLabel(t, p.partnerProfile?.onboardingState),
    organizationStatusListLabel(t, p.status),
  ]
    .join(" ")
    .toLowerCase();
}

export function PartnersListClient() {
  const t = useT();
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [view, setView] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "table";
  });

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    async function fetchPartners() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(FETCH_LIMIT) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/saas/partners?${params}`);
        if (!res.ok) {
          setError(t("superadmin.partners.failedToLoad"));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAllPartners(data.partners ?? []);
          setTotal(data.total ?? 0);
        }
      } catch {
        if (!cancelled) setError(t("superadmin.partners.failedToLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPartners();
    return () => {
      cancelled = true;
    };
  }, [t, debouncedSearch]);

  if (error) {
    return (
      <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {total} {total !== 1 ? t("superadmin.partners.countPlural") : t("superadmin.partners.count")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder={t("superadmin.partners.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setDebouncedSearch(searchInput.trim())}
            className="rounded-sm border border-input bg-background px-3 py-1.5 text-sm min-w-[200px]"
          />
          <button
            type="button"
            onClick={() => setDebouncedSearch(searchInput.trim())}
            className="rounded-sm px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
          >
            {t("superadmin.partners.search")}
          </button>
          <ViewLayoutToggle view={view} onViewChange={setView} />
          <Link
            href="/superadmin/partners/new"
            className="inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("superadmin.partners.newPartner")}
          </Link>
        </div>
      </div>

      <div className="surface-card-overflow">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("superadmin.partners.loading")}</div>
        ) : allPartners.length === 0 && debouncedSearch ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.partners.noMatchSearch")}</p>
          </div>
        ) : allPartners.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("superadmin.partners.noPartnersYet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.partners.emptyStateHint")}</p>
            <Link
              href="/superadmin/partners/new"
              className="mt-4 inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("superadmin.partners.newPartner")}
            </Link>
          </div>
        ) : view === "table" ? (
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
                {allPartners.map((p) => (
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
        ) : (
          <div className="grid gap-4 p-4 sm:p-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {allPartners.map((p) => (
              <div
                key={p.id}
                className="surface-card p-5 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "active" ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {organizationStatusListLabel(t, p.status)}
                  </span>
                </div>
                <Link
                  href={`/superadmin/partners/${p.id}`}
                  className="mt-2 block font-semibold text-foreground hover:text-primary"
                >
                  {p.name}
                </Link>
                {p.countryCode && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {p.countryCode}
                  </p>
                )}
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("superadmin.partners.listColType")}
                </p>
                <p className="mt-0.5 text-sm text-foreground">{partnerTypeListLabel(t, p.partnerProfile?.partnerType)}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("superadmin.partners.listColContact")}
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {p.partnerProfile?.contactName ?? p.partnerProfile?.contactEmail ?? "—"}
                </p>
                {p.partnerProfile?.contactEmail && (
                  <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {p.partnerProfile.contactEmail}
                  </p>
                )}
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("superadmin.partners.listColOnboarding")}
                </p>
                <span className="mt-0.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  {onboardingListLabel(t, p.partnerProfile?.onboardingState)}
                </span>
                <Link
                  href={`/superadmin/partners/${p.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("superadmin.partners.manage")} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && allPartners.length > 0 && debouncedSearch && (
        <p className="text-sm text-muted-foreground">
          {t("superadmin.partners.showingCount", { shown: allPartners.length, total })}
        </p>
      )}
    </div>
  );
}

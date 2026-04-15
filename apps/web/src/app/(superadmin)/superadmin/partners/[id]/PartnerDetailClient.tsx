"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Mail,
  Globe,
  Settings,
  Users,
  UserPlus,
  Target,
  Phone,
} from "lucide-react";
import { PartnerTerritoriesSection, type PartnerTerritoryRow } from "./PartnerTerritoriesSection";
import { useT, useLanguage } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterSelect } from "@/components/ui/filter-select";

function engineeringFeeModeLabel(t: (key: string) => string, mode: string | null | undefined): string {
  if (!mode) return "—";
  const key = `superadmin.partner.engineeringFee.${mode}`;
  const out = t(key);
  return out === key ? mode : out;
}

function partnerTypeDisplay(t: (key: string) => string, partnerType: string | null | undefined): string {
  if (!partnerType) return "—";
  if (partnerType === "commercial_partner") return t("superadmin.partners.commercialPartner");
  if (partnerType === "master_partner") return t("superadmin.partners.masterPartner");
  return partnerType.replace(/_/g, " ");
}

function organizationStatusLabel(t: (key: string) => string, status: string | null | undefined): string {
  if (!status) return "—";
  if (status === "active") return t("admin.users.statusActive");
  if (status === "suspended") return t("admin.users.statusSuspended");
  if (status === "pending") return t("admin.users.statusPending");
  return status;
}

function onboardingStateLabel(t: (key: string) => string, state: string): string {
  const key = `superadmin.partner.onboarding.${state}`;
  const out = t(key);
  return out === key ? state.replace(/_/g, " ") : out;
}

function memberRoleDisplay(t: (key: string) => string, role: string): string {
  const map: Record<string, string> = {
    owner: "superadmin.partner.teamRole.owner",
    admin: "superadmin.partner.teamRole.admin",
    sales: "superadmin.partner.teamRole.sales",
    engineer: "superadmin.partner.teamRole.engineer",
    viewer: "superadmin.partner.memberRole.viewer",
    org_admin: "superadmin.partner.memberRole.org_admin",
    sales_user: "superadmin.partner.memberRole.sales_user",
    technical_user: "superadmin.partner.memberRole.technical_user",
  };
  const tr = map[role];
  return tr ? t(tr) : role;
}

function memberStatusDisplay(t: (key: string) => string, status: string): string {
  const key = `superadmin.partner.memberStatus.${status}`;
  const out = t(key);
  return out === key ? status : out;
}

type Territory = PartnerTerritoryRow;

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
    engineeringFeeMode?: string | null;
    onboardingState?: string | null;
    engineeringFeeValue?: number | null;
    entryFeeUsd?: number | null;
    trainingFeeUsd?: number | null;
    materialCreditUsd?: number | null;
    marginMinPct?: number | null;
    marginMaxPct?: number | null;
    minimumPricePolicy?: string | null;
    salesTargetAnnualUsd?: number | null;
    salesTargetAnnualM2?: number | null;
    agreementStartDate?: string | null;
    agreementEndDate?: string | null;
    agreementStatus?: string | null;
    visionLatamCommissionPct?: number | null;
    visionLatamCommissionFixedUsd?: number | null;
  } | null;
  territories: Territory[];
};

const TABS = [
  { id: "overview" as const, labelKey: "superadmin.partner.tabs.overview" as const, icon: Building2 },
  { id: "team" as const, labelKey: "superadmin.partner.tabs.team" as const, icon: Users },
] as const;

const TEAM_ROLES = [
  { value: "owner" as const, labelKey: "superadmin.partner.teamRole.owner" as const },
  { value: "admin" as const, labelKey: "superadmin.partner.teamRole.admin" as const },
  { value: "sales" as const, labelKey: "superadmin.partner.teamRole.sales" as const },
  { value: "engineer" as const, labelKey: "superadmin.partner.teamRole.engineer" as const },
  { value: "viewer" as const, labelKey: "superadmin.partner.teamRole.viewer" as const },
] as const;

const ONBOARDING_STATES = [
  "application_received",
  "agreement_signed",
  "training_started",
  "training_completed",
  "active",
] as const;

const AGREEMENT_STATUS_OPTIONS = [
  { value: "", labelKey: "superadmin.partner.agreementStatusNone" },
  { value: "active", labelKey: "superadmin.partners.agreementStatusActive" },
  { value: "expired", labelKey: "superadmin.partners.agreementStatusExpired" },
  { value: "pending", labelKey: "superadmin.partners.agreementStatusPending" },
  { value: "suspended", labelKey: "superadmin.partners.agreementStatusSuspended" },
] as const;

export function PartnerDetailClient({
  partnerId,
  initialPartner,
  inviteSent,
}: {
  partnerId: string;
  initialPartner: Partner;
  inviteSent?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [dismissInviteBanner, setDismissInviteBanner] = useState(false);
  const [partner, setPartner] = useState<Partner>(initialPartner);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState(
    partner.partnerProfile?.onboardingState ?? ""
  );
  const [territories, setTerritories] = useState<Territory[]>(partner.territories ?? []);

  async function refreshPartner() {
    try {
      const res = await fetch(`/api/saas/partners/${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setPartner(data);
        setOnboardingState(data.partnerProfile?.onboardingState ?? "");
        setTerritories(data.territories ?? []);
      }
    } catch {
      // ignore
    }
  }

  async function handleUpdateOnboarding(state: string) {
    if (!state) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/saas/partners/${partnerId}/onboard`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message ?? t("superadmin.partners.failedToUpdate"));
        return;
      }
      setOnboardingState(state);
      await refreshPartner();
      router.refresh();
    } catch {
      setError(t("superadmin.partners.failedToUpdateOnboarding"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border/60">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-input hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {inviteSent && !dismissInviteBanner && (
        <div className="rounded-lg border border-alert-successBorder bg-alert-success px-4 py-3 text-sm text-foreground flex items-center justify-between">
          <span>
            {inviteSent === "new"
              ? t("superadmin.partner.inviteBannerNewAccount")
              : t("superadmin.partner.inviteBannerSignIn")}
          </span>
          <button
            type="button"
            onClick={() => setDismissInviteBanner(true)}
            className="ml-2 text-primary hover:underline"
            aria-label={t("common.dismiss")}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-alert-errorBorder bg-alert-error px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="surface-card p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.partner.detail.company")}</p>
              <p className="mt-1 text-foreground font-medium">{partner.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.partner.detail.partnerType")}</p>
              <p className="mt-1 text-foreground">
                {partnerTypeDisplay(t, partner.partnerProfile?.partnerType)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.partner.detail.status")}</p>
              <p className="mt-1">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    partner.status === "active"
                      ? "border border-primary/25 bg-primary/10 text-primary"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {organizationStatusLabel(t, partner.status)}
                </span>
              </p>
            </div>
            {partner.countryCode && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-foreground">{partner.countryCode}</span>
              </div>
            )}
            {partner.partnerProfile?.contactName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("superadmin.partner.detail.contact")}</p>
                <p className="mt-1 text-foreground">{partner.partnerProfile.contactName}</p>
              </div>
            )}
            {partner.partnerProfile?.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground/70" />
                <a
                  href={`mailto:${partner.partnerProfile.contactEmail}`}
                  className="text-primary hover:underline"
                >
                  {partner.partnerProfile.contactEmail}
                </a>
              </div>
            )}
            {partner.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground/70" />
                <a
                  href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {partner.website}
                </a>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("superadmin.partner.detail.engineeringFeeMode")}</p>
              <p className="mt-1 text-foreground">
                {engineeringFeeModeLabel(t, partner.partnerProfile?.engineeringFeeMode)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t("superadmin.partner.summaryCommercialTitle")}</h3>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.onboardingState")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.partner.onboardingHelp")}</p>
              <div className="mt-2">
                <FilterSelect
                  value={onboardingState}
                  onValueChange={handleUpdateOnboarding}
                  emptyOptionLabel={t("superadmin.partner.onboardingNotSet")}
                  options={ONBOARDING_STATES.map((s) => ({
                    value: s,
                    label: onboardingStateLabel(t, s),
                  }))}
                  disabled={saving}
                  aria-label={t("superadmin.partner.detail.onboardingState")}
                  triggerClassName="h-10 max-w-xs min-w-0 text-sm"
                />
                {saving && <p className="mt-2 text-sm text-muted-foreground">{t("superadmin.partner.detail.saving")}</p>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("superadmin.partner.commissionPctLabel")}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {partner.partnerProfile?.visionLatamCommissionPct != null
                    ? `${partner.partnerProfile.visionLatamCommissionPct}%`
                    : t("superadmin.partner.commissionUsesGlobal")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("superadmin.partner.commissionFixedUsdLabel")}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {partner.partnerProfile?.visionLatamCommissionFixedUsd != null
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                        partner.partnerProfile.visionLatamCommissionFixedUsd
                      )
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("superadmin.partner.summaryMarginsLabel")}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {partner.partnerProfile?.marginMinPct != null || partner.partnerProfile?.marginMaxPct != null
                    ? `${partner.partnerProfile?.marginMinPct ?? "—"}% – ${partner.partnerProfile?.marginMaxPct ?? "—"}%`
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("superadmin.partner.commissionSectionHelp")}</p>
            <Link href={`/superadmin/partners/${partnerId}/edit`} className="inline-block text-sm text-primary hover:underline">
              {t("superadmin.partner.summaryEditCommissionLink")}
            </Link>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium text-foreground">{t("superadmin.partner.detail.annualGoals")}</h3>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById("partner-parameters-block")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="text-sm text-primary hover:underline"
              >
                {t("superadmin.partner.detail.editInParameters")}
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">{t("superadmin.partner.detail.salesTargetUsd")}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {partner.partnerProfile?.salesTargetAnnualUsd != null
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(partner.partnerProfile.salesTargetAnnualUsd)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("superadmin.partner.detail.salesTargetM2")}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {partner.partnerProfile?.salesTargetAnnualM2 != null
                    ? partner.partnerProfile.salesTargetAnnualM2.toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
          </div>
          </div>

          <PartnerTerritoriesSection
            partnerId={partnerId}
            territories={territories}
            onUpdate={() => {
              refreshPartner();
              router.refresh();
            }}
            setTerritories={setTerritories}
          />

          <div id="partner-parameters-block">
            <ParametersSection partnerId={partnerId} partner={partner} onSaved={refreshPartner} />
          </div>

          <Link
            href={`/superadmin/partners/${partnerId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
            {t("superadmin.partner.editPartner")}
          </Link>
        </div>
      )}

      {activeTab === "team" && (
        <TeamSection partnerId={partnerId} partnerName={partner.name} />
      )}
    </div>
  );
}

type OrgMemberRow = {
  id: string;
  role: string;
  status: string;
  createdAt?: string;
  joinedAt?: string | null;
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone?: string | null;
    lastLoginAt?: string | null;
    emailLocale?: string;
    emailVerified?: string | null;
    createdAt?: string;
    isActive?: boolean;
  };
};

function formatMemberDate(iso: string | undefined | null, loc: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(loc === "es" ? "es" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function TeamSection({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const t = useT();
  const { locale } = useLanguage();
  const loc = locale === "es" ? "es" : "en";
  const [members, setMembers] = useState<OrgMemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "sales" | "engineer" | "viewer">("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMembers() {
      try {
        const res = await fetch(
          `/api/saas/org-members?organizationId=${encodeURIComponent(partnerId)}&limit=100`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMembers(data.members ?? []);
          setTotal(data.total ?? 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMembers();
    return () => { cancelled = true; };
  }, [partnerId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/saas/partners/${partnerId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data?.error ?? t("superadmin.partners.failedToInvite"));
        return;
      }
      setInviteEmail("");
      setInviteRole("viewer");
      setInviteOpen(false);
      if (data.pendingInvite) {
        setInviteSuccess(data.message ?? t("superadmin.partner.inviteSuccessNewUser"));
      } else {
        const resList = await fetch(
          `/api/saas/org-members?organizationId=${encodeURIComponent(partnerId)}&limit=100`
        );
        if (resList.ok) {
          const listData = await resList.json();
          setMembers(listData.members ?? []);
          setTotal(listData.total ?? 0);
        }
      }
    } catch {
      setInviteError(t("superadmin.partners.failedToInvite"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="surface-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">{t("superadmin.partner.detail.team")}</h3>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          {t("partner.team.inviteByEmail")}
        </button>
      </div>

      {inviteOpen && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">
            {t("superadmin.partner.inviteMemberTo", { partner: partnerName })}
          </p>
          {inviteError && (
            <p className="text-sm text-destructive">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-sm text-foreground">{inviteSuccess}</p>
          )}
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("auth.email")}</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("superadmin.partner.detail.inviteEmailPlaceholder")}
                className="input-native mt-1 max-w-[14rem]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">{t("admin.users.role")}</label>
              <FilterSelect
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
                options={TEAM_ROLES.map((r) => ({ value: r.value, label: t(r.labelKey) }))}
                aria-label={t("admin.users.role")}
                triggerClassName="h-10 mt-1 min-w-[10rem] max-w-full text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t("partner.team.inviting") : t("partner.team.invite")}
            </button>
            <button
              type="button"
              onClick={() => { setInviteOpen(false); setInviteError(null); }}
              className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
          </form>
          <p className="text-xs text-muted-foreground">
            {t("superadmin.partner.teamInviteHelp")}
          </p>
        </div>
      )}

      {inviteSuccess && (
        <div className="rounded-lg border border-alert-successBorder bg-alert-success px-4 py-2 text-sm text-foreground">
          {inviteSuccess}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("superadmin.partners.loadingMembers")}</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("superadmin.partners.noMembersYetInvite")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("common.name")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("auth.email")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("partner.team.colPhone")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("admin.users.role")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("partner.engineering.status")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("partner.team.colMemberSince")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">{t("partner.team.colLastLogin")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium text-foreground">{m.user?.fullName ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {m.user?.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        {m.user.email}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {m.user?.phone?.trim() ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        {m.user.phone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-foreground">
                      {memberRoleDisplay(t, m.role)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        m.status === "active"
                          ? "border border-primary/25 bg-primary/10 text-primary"
                          : m.status === "invited"
                            ? "border border-border/80 bg-muted text-foreground"
                            : "bg-muted text-foreground"
                      }`}
                    >
                      {memberStatusDisplay(t, m.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatMemberDate(m.joinedAt ?? m.createdAt, loc)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatMemberDate(m.user?.lastLoginAt, loc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ENGINEERING_FEE_MODES = [
  { value: "fixed" as const, labelKey: "superadmin.partner.engineeringFee.fixed" as const },
  { value: "percent" as const, labelKey: "superadmin.partner.engineeringFee.percent" as const },
  { value: "per_request" as const, labelKey: "superadmin.partner.engineeringFee.per_request" as const },
  { value: "included" as const, labelKey: "superadmin.partner.engineeringFee.included" as const },
] as const;

type PlatformDefaults = {
  pricing?: {
    defaultMarginMinPct?: number;
    defaultMarginMaxPct?: number;
    defaultEntryFeeUsd?: number;
    defaultTrainingFeeUsd?: number;
  };
};

function formatUsdDisplay(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function ParametersSection({
  partnerId,
  partner,
  onSaved,
}: {
  partnerId: string;
  partner: Partner;
  onSaved: () => void;
}) {
  const t = useT();
  const profile = partner.partnerProfile;
  const [isEditing, setIsEditing] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<PlatformDefaults | null>(null);
  const [entryFeeUsd, setEntryFeeUsd] = useState("");
  const [trainingFeeUsd, setTrainingFeeUsd] = useState("");
  const [materialCreditUsd, setMaterialCreditUsd] = useState("");
  const [engineeringFeeMode, setEngineeringFeeMode] = useState("");
  const [engineeringFeeValue, setEngineeringFeeValue] = useState("");
  const [marginMinPct, setMarginMinPct] = useState("");
  const [marginMaxPct, setMarginMaxPct] = useState("");
  const [minimumPricePolicy, setMinimumPricePolicy] = useState("");
  const [salesTargetAnnualUsd, setSalesTargetAnnualUsd] = useState("");
  const [salesTargetAnnualM2, setSalesTargetAnnualM2] = useState("");
  const [agreementStartDate, setAgreementStartDate] = useState("");
  const [agreementEndDate, setAgreementEndDate] = useState("");
  const [agreementStatus, setAgreementStatus] = useState("");

  const resetDraftFromPartner = useCallback(() => {
    const p = partner.partnerProfile;
    setEntryFeeUsd(p?.entryFeeUsd != null ? String(p.entryFeeUsd) : "");
    setTrainingFeeUsd(p?.trainingFeeUsd != null ? String(p.trainingFeeUsd) : "");
    setMaterialCreditUsd(p?.materialCreditUsd != null ? String(p.materialCreditUsd) : "");
    setEngineeringFeeMode(p?.engineeringFeeMode ?? "");
    setEngineeringFeeValue(p?.engineeringFeeValue != null ? String(p.engineeringFeeValue) : "");
    setMarginMinPct(p?.marginMinPct != null ? String(p.marginMinPct) : "");
    setMarginMaxPct(p?.marginMaxPct != null ? String(p.marginMaxPct) : "");
    setMinimumPricePolicy(p?.minimumPricePolicy ?? "");
    setSalesTargetAnnualUsd(p?.salesTargetAnnualUsd != null ? String(p.salesTargetAnnualUsd) : "");
    setSalesTargetAnnualM2(p?.salesTargetAnnualM2 != null ? String(p.salesTargetAnnualM2) : "");
    setAgreementStartDate(p?.agreementStartDate ? String(p.agreementStartDate).slice(0, 10) : "");
    setAgreementEndDate(p?.agreementEndDate ? String(p.agreementEndDate).slice(0, 10) : "");
    setAgreementStatus(p?.agreementStatus ?? "");
  }, [partner]);

  useEffect(() => {
    if (!isEditing) resetDraftFromPartner();
  }, [partner, isEditing, resetDraftFromPartner]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saas/platform-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setDefaults(data as PlatformDefaults);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function beginEdit() {
    resetDraftFromPartner();
    setError(null);
    setSuccessMessage(null);
    setIsEditing(true);
  }

  function cancelEdit() {
    resetDraftFromPartner();
    setError(null);
    setIsEditing(false);
  }

  async function executeSave() {
    setError(null);
    setSuccessMessage(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (entryFeeUsd !== "") body.entryFeeUsd = parseFloat(entryFeeUsd);
      else body.entryFeeUsd = null;
      if (trainingFeeUsd !== "") body.trainingFeeUsd = parseFloat(trainingFeeUsd);
      else body.trainingFeeUsd = null;
      if (materialCreditUsd !== "") body.materialCreditUsd = parseFloat(materialCreditUsd);
      else body.materialCreditUsd = null;
      if (engineeringFeeMode) body.engineeringFeeMode = engineeringFeeMode;
      else body.engineeringFeeMode = null;
      if (engineeringFeeValue !== "") body.engineeringFeeValue = parseFloat(engineeringFeeValue);
      else body.engineeringFeeValue = null;
      if (marginMinPct !== "") body.marginMinPct = parseFloat(marginMinPct);
      else body.marginMinPct = null;
      if (marginMaxPct !== "") body.marginMaxPct = parseFloat(marginMaxPct);
      else body.marginMaxPct = null;
      if (minimumPricePolicy.trim()) body.minimumPricePolicy = minimumPricePolicy.trim();
      else body.minimumPricePolicy = null;
      if (salesTargetAnnualUsd !== "") body.salesTargetAnnualUsd = parseFloat(salesTargetAnnualUsd);
      else body.salesTargetAnnualUsd = null;
      if (salesTargetAnnualM2 !== "") body.salesTargetAnnualM2 = parseFloat(salesTargetAnnualM2);
      else body.salesTargetAnnualM2 = null;
      body.agreementStartDate = agreementStartDate.trim() || null;
      body.agreementEndDate = agreementEndDate.trim() || null;
      body.agreementStatus = agreementStatus.trim() || null;

      const res = await fetch(`/api/saas/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data?.error === "string" ? data.error : data?.error?.message ?? t("superadmin.partners.failedToSave"));
        return;
      }
      setConfirmSaveOpen(false);
      setIsEditing(false);
      onSaved();
      setSuccessMessage(t("superadmin.partners.parametersSaved"));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setError(t("superadmin.partners.failedToSaveParameters"));
    } finally {
      setSaving(false);
    }
  }

  const p = profile;
  const agreementStatusRaw = p?.agreementStatus ?? "";
  const agreementStatusOption = AGREEMENT_STATUS_OPTIONS.find((o) => o.value === agreementStatusRaw);
  const agreementStatusRead = agreementStatusOption
    ? t(agreementStatusOption.labelKey)
    : agreementStatusRaw || "—";

  return (
    <div className="surface-card p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-foreground">{t("superadmin.partner.detail.parametersTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("superadmin.partner.parametersViewHint")}</p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={beginEdit}
            className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("superadmin.partner.parametersEditButton")}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("superadmin.partner.parametersCancelEdit")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSaveOpen(true)}
              disabled={saving}
              className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {t("superadmin.partner.saveParameters")}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {successMessage && (
        <div className="rounded-lg border border-alert-successBorder bg-alert-success p-3 text-sm text-foreground">
          {successMessage}
        </div>
      )}

      {!isEditing ? (
        <div className="space-y-6 text-sm">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partner.detail.fees")}</h4>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.paramEntryFeeUsd")}</dt>
                <dd className="font-medium text-foreground">{p?.entryFeeUsd != null ? formatUsdDisplay(p.entryFeeUsd) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.paramTrainingFeeUsd")}</dt>
                <dd className="font-medium text-foreground">{p?.trainingFeeUsd != null ? formatUsdDisplay(p.trainingFeeUsd) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.materialCreditUsd")}</dt>
                <dd className="font-medium text-foreground">{p?.materialCreditUsd != null ? formatUsdDisplay(p.materialCreditUsd) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.edit.engineeringFeeMode")}</dt>
                <dd className="font-medium text-foreground">{engineeringFeeModeLabel(t, p?.engineeringFeeMode)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.engineeringFeeValue")}</dt>
                <dd className="font-medium text-foreground">{p?.engineeringFeeValue != null ? String(p.engineeringFeeValue) : "—"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partner.detail.marginsPricing")}</h4>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.paramMinMarginPct")}</dt>
                <dd className="font-medium text-foreground">{p?.marginMinPct != null ? `${p.marginMinPct}%` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.paramMaxMarginPct")}</dt>
                <dd className="font-medium text-foreground">{p?.marginMaxPct != null ? `${p.marginMaxPct}%` : "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.minimumPricePolicy")}</dt>
                <dd className="font-medium text-foreground">{p?.minimumPricePolicy?.trim() ? p.minimumPricePolicy : "—"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partner.detail.salesTargets")}</h4>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.annualTargetUsd")}</dt>
                <dd className="font-medium text-foreground">{p?.salesTargetAnnualUsd != null ? formatUsdDisplay(p.salesTargetAnnualUsd) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.annualTargetM2")}</dt>
                <dd className="font-medium text-foreground">{p?.salesTargetAnnualM2 != null ? p.salesTargetAnnualM2.toLocaleString() : "—"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">{t("superadmin.partner.detail.agreement")}</h4>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.startDate")}</dt>
                <dd className="font-medium text-foreground">{p?.agreementStartDate ? String(p.agreementStartDate).slice(0, 10) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.endDate")}</dt>
                <dd className="font-medium text-foreground">{p?.agreementEndDate ? String(p.agreementEndDate).slice(0, 10) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("superadmin.partner.detail.status")}</dt>
                <dd className="font-medium text-foreground">{agreementStatusRead}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">{t("superadmin.partner.parametersIntro")}</p>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">{t("superadmin.partner.detail.fees")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  {t("superadmin.partner.paramEntryFeeUsd")}
                  {defaults?.pricing?.defaultEntryFeeUsd != null && entryFeeUsd === "" && (
                    <span className="ml-1 font-normal text-muted-foreground/70">
                      {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultEntryFeeUsd })}
                    </span>
                  )}
                </label>
                <input type="text" inputMode="decimal" value={entryFeeUsd} onChange={(e) => setEntryFeeUsd(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  {t("superadmin.partner.paramTrainingFeeUsd")}
                  {defaults?.pricing?.defaultTrainingFeeUsd != null && trainingFeeUsd === "" && (
                    <span className="ml-1 font-normal text-muted-foreground/70">
                      {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultTrainingFeeUsd })}
                    </span>
                  )}
                </label>
                <input type="text" inputMode="decimal" value={trainingFeeUsd} onChange={(e) => setTrainingFeeUsd(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.materialCreditUsd")}</label>
                <input type="text" inputMode="decimal" value={materialCreditUsd} onChange={(e) => setMaterialCreditUsd(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.edit.engineeringFeeMode")}</label>
                <FilterSelect
                  value={engineeringFeeMode}
                  onValueChange={setEngineeringFeeMode}
                  emptyOptionLabel={t("superadmin.partner.onboardingNotSet")}
                  options={ENGINEERING_FEE_MODES.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
                  aria-label={t("superadmin.partner.edit.engineeringFeeMode")}
                  triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.engineeringFeeValue")}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={engineeringFeeValue}
                  onChange={(e) => setEngineeringFeeValue(e.target.value)}
                  className="input-native mt-1"
                  placeholder={t("superadmin.partner.detail.placeholderEngineeringFee")}
                />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">{t("superadmin.partner.detail.marginsPricing")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  {t("superadmin.partner.paramMinMarginPct")}
                  {defaults?.pricing?.defaultMarginMinPct != null && marginMinPct === "" && (
                    <span className="ml-1 font-normal text-muted-foreground/70">
                      {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultMarginMinPct })}
                    </span>
                  )}
                </label>
                <input type="text" inputMode="decimal" value={marginMinPct} onChange={(e) => setMarginMinPct(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  {t("superadmin.partner.paramMaxMarginPct")}
                  {defaults?.pricing?.defaultMarginMaxPct != null && marginMaxPct === "" && (
                    <span className="ml-1 font-normal text-muted-foreground/70">
                      {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultMarginMaxPct })}
                    </span>
                  )}
                </label>
                <input type="text" inputMode="decimal" value={marginMaxPct} onChange={(e) => setMarginMaxPct(e.target.value)} className="input-native mt-1" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.minimumPricePolicy")}</label>
                <input
                  type="text"
                  value={minimumPricePolicy}
                  onChange={(e) => setMinimumPricePolicy(e.target.value)}
                  className="input-native mt-1"
                  placeholder={t("superadmin.partner.detail.placeholderMinPricePolicy")}
                />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">{t("superadmin.partner.detail.salesTargets")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.annualTargetUsd")}</label>
                <input type="text" inputMode="decimal" value={salesTargetAnnualUsd} onChange={(e) => setSalesTargetAnnualUsd(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.annualTargetM2")}</label>
                <input type="text" inputMode="decimal" value={salesTargetAnnualM2} onChange={(e) => setSalesTargetAnnualM2(e.target.value)} className="input-native mt-1" />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">{t("superadmin.partner.detail.agreement")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.startDate")}</label>
                <input type="date" value={agreementStartDate} onChange={(e) => setAgreementStartDate(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.endDate")}</label>
                <input type="date" value={agreementEndDate} onChange={(e) => setAgreementEndDate(e.target.value)} className="input-native mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">{t("superadmin.partner.detail.status")}</label>
                <FilterSelect
                  value={agreementStatus}
                  onValueChange={setAgreementStatus}
                  emptyOptionLabel={t("superadmin.partner.agreementStatusNone")}
                  options={AGREEMENT_STATUS_OPTIONS.filter((o) => o.value !== "").map((o) => ({
                    value: o.value,
                    label: t(o.labelKey),
                  }))}
                  aria-label={t("superadmin.partner.detail.status")}
                  triggerClassName="mt-1 h-10 w-full min-w-0 max-w-full text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSaveOpen}
        onOpenChange={(open) => !open && !saving && setConfirmSaveOpen(false)}
        title={t("superadmin.partner.parametersSaveConfirmTitle")}
        description={t("superadmin.partner.parametersSaveConfirmDescription")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        loadingLabel={t("common.saving")}
        variant="primary"
        loading={saving}
        onConfirm={executeSave}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Mail,
  Globe,
  Settings,
  MapPinned,
  ClipboardList,
  Sliders,
  Users,
  UserPlus,
  Target,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
    viewer: "superadmin.partner.teamRole.viewer",
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

function territoryTypeDisplay(t: (key: string) => string, territoryType: string): string {
  const key = `superadmin.partner.territoryType.${territoryType}`;
  const out = t(key);
  return out === key ? territoryType : out;
}

type Territory = {
  id: string;
  countryCode: string;
  region?: string | null;
  territoryType: string;
};

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
  { id: "territories" as const, labelKey: "superadmin.partner.tabs.territories" as const, icon: MapPinned },
  { id: "onboarding" as const, labelKey: "superadmin.partner.tabs.onboarding" as const, icon: ClipboardList },
  { id: "parameters" as const, labelKey: "superadmin.partner.tabs.parameters" as const, icon: Sliders },
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
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-vbt-blue text-vbt-blue"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {inviteSent && !dismissInviteBanner && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
          <span>
            {inviteSent === "new"
              ? t("superadmin.partner.inviteBannerNewAccount")
              : t("superadmin.partner.inviteBannerSignIn")}
          </span>
          <button
            type="button"
            onClick={() => setDismissInviteBanner(true)}
            className="text-green-600 hover:text-green-800 ml-2"
            aria-label={t("common.dismiss")}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {activeTab === "overview" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500">{t("superadmin.partner.detail.company")}</p>
              <p className="mt-1 text-gray-900 font-medium">{partner.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t("superadmin.partner.detail.partnerType")}</p>
              <p className="mt-1 text-gray-900">
                {partnerTypeDisplay(t, partner.partnerProfile?.partnerType)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t("superadmin.partner.detail.status")}</p>
              <p className="mt-1">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    partner.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {organizationStatusLabel(t, partner.status)}
                </span>
              </p>
            </div>
            {partner.countryCode && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{partner.countryCode}</span>
              </div>
            )}
            {partner.partnerProfile?.contactName && (
              <div>
                <p className="text-sm font-medium text-gray-500">{t("superadmin.partner.detail.contact")}</p>
                <p className="mt-1 text-gray-900">{partner.partnerProfile.contactName}</p>
              </div>
            )}
            {partner.partnerProfile?.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <a
                  href={`mailto:${partner.partnerProfile.contactEmail}`}
                  className="text-vbt-blue hover:underline"
                >
                  {partner.partnerProfile.contactEmail}
                </a>
              </div>
            )}
            {partner.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                <a
                  href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vbt-blue hover:underline"
                >
                  {partner.website}
                </a>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500">{t("superadmin.partner.detail.engineeringFeeMode")}</p>
              <p className="mt-1 text-gray-900">
                {engineeringFeeModeLabel(t, partner.partnerProfile?.engineeringFeeMode)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">{t("superadmin.partner.commissionSectionTitle")}</h3>
              <Link
                href={`/superadmin/partners/${partnerId}/edit`}
                className="text-sm text-vbt-blue hover:underline"
              >
                {t("common.edit")}
              </Link>
            </div>
            <p className="mt-1 text-xs text-gray-500">{t("superadmin.partner.commissionSectionHelp")}</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-gray-500">{t("superadmin.partner.commissionPctLabel")}</p>
                <p className="font-medium text-gray-900">
                  {partner.partnerProfile?.visionLatamCommissionPct != null
                    ? `${partner.partnerProfile.visionLatamCommissionPct}%`
                    : t("superadmin.partner.commissionUsesGlobal")}
                </p>
              </div>
              {partner.partnerProfile?.visionLatamCommissionFixedUsd != null && partner.partnerProfile.visionLatamCommissionFixedUsd > 0 && (
                <div>
                  <p className="text-xs text-gray-500">{t("superadmin.partner.commissionFixedUsdLabel")}</p>
                  <p className="font-medium text-gray-900">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(partner.partnerProfile.visionLatamCommissionFixedUsd)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Annual goals (read-only); edit in Parameters tab */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-medium text-gray-900">{t("superadmin.partner.detail.annualGoals")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("parameters")}
                className="text-sm text-vbt-blue hover:underline"
              >
                {t("superadmin.partner.detail.editInParameters")}
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">{t("superadmin.partner.detail.salesTargetUsd")}</p>
                <p className="mt-0.5 font-medium text-gray-900">
                  {partner.partnerProfile?.salesTargetAnnualUsd != null
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(partner.partnerProfile.salesTargetAnnualUsd)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t("superadmin.partner.detail.salesTargetM2")}</p>
                <p className="mt-0.5 font-medium text-gray-900">
                  {partner.partnerProfile?.salesTargetAnnualM2 != null
                    ? partner.partnerProfile.salesTargetAnnualM2.toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          <Link
            href={`/superadmin/partners/${partnerId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            {t("superadmin.partner.editPartner")}
          </Link>
        </div>
      )}

      {activeTab === "team" && (
        <TeamSection partnerId={partnerId} partnerName={partner.name} />
      )}

      {activeTab === "territories" && (
        <TerritoriesSection
          partnerId={partnerId}
          territories={territories}
          onUpdate={() => {
            refreshPartner();
            router.refresh();
          }}
          setTerritories={setTerritories}
        />
      )}

      {activeTab === "onboarding" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">{t("superadmin.partner.detail.onboardingState")}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {t("superadmin.partner.onboardingHelp")}
          </p>
          <div className="mt-4">
            <select
              value={onboardingState}
              onChange={(e) => handleUpdateOnboarding(e.target.value)}
              disabled={saving}
              className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
            >
              <option value="">{t("superadmin.partner.onboardingNotSet")}</option>
              {ONBOARDING_STATES.map((s) => (
                <option key={s} value={s}>
                  {onboardingStateLabel(t, s)}
                </option>
              ))}
            </select>
            {saving && <p className="mt-2 text-sm text-gray-500">{t("superadmin.partner.detail.saving")}</p>}
          </div>
        </div>
      )}

      {activeTab === "parameters" && (
        <ParametersSection partnerId={partnerId} partner={partner} onSaved={refreshPartner} />
      )}
    </div>
  );
}

type OrgMemberRow = {
  id: string;
  role: string;
  status: string;
  user: { id: string; fullName: string | null; email: string | null };
};

function TeamSection({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const t = useT();
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
        setMembers((prev) => [...prev, { ...data, user: data.user ?? { id: data.userId, fullName: null, email: inviteEmail.trim() } }]);
        setTotal((prev) => prev + 1);
      }
    } catch {
      setInviteError(t("superadmin.partners.failedToInvite"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{t("superadmin.partner.detail.team")}</h3>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-vbt-blue/90"
        >
          <UserPlus className="h-4 w-4" />
          {t("partner.team.inviteByEmail")}
        </button>
      </div>

      {inviteOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {t("superadmin.partner.inviteMemberTo", { partner: partnerName })}
          </p>
          {inviteError && (
            <p className="text-sm text-red-600">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-sm text-green-700">{inviteSuccess}</p>
          )}
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("auth.email")}</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("superadmin.partner.detail.inviteEmailPlaceholder")}
                className="mt-1 block w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("admin.users.role")}</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-vbt-blue focus:ring-1 focus:ring-vbt-blue"
              >
                {TEAM_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50"
            >
              {submitting ? t("partner.team.inviting") : t("partner.team.invite")}
            </button>
            <button
              type="button"
              onClick={() => { setInviteOpen(false); setInviteError(null); }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
          </form>
          <p className="text-xs text-gray-500">
            {t("superadmin.partner.teamInviteHelp")}
          </p>
        </div>
      )}

      {inviteSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
          {inviteSuccess}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">{t("superadmin.partners.loadingMembers")}</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-500">{t("superadmin.partners.noMembersYetInvite")}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {members.map((m) => (
            <li key={m.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{m.user?.fullName ?? "—"}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {m.user?.email ?? "—"}
                </p>
              </div>
              <span className="text-xs rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-700">
                {memberRoleDisplay(t, m.role)}
              </span>
              <span
                className={`text-xs rounded-full px-2.5 py-0.5 ${
                  m.status === "active"
                    ? "bg-green-100 text-green-800"
                    : m.status === "invited"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {memberStatusDisplay(t, m.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TerritoriesSection({
  partnerId,
  territories,
  onUpdate,
  setTerritories,
}: {
  partnerId: string;
  territories: Territory[];
  onUpdate: () => void;
  setTerritories: (t: Territory[]) => void;
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
      setTerritories(territories.filter((t) => t.id !== territoryId));
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{t("superadmin.partner.detail.territories")}</h3>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-vbt-blue/90"
          >
            {t("superadmin.partner.addTerritory")}
          </button>
        ) : null}
      </div>

      {adding && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.countryCode")}</label>
              <input
                type="text"
                maxLength={2}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                className="mt-1 block w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.region")}</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 block w-32 rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.territoryType")}</label>
              <select
                value={territoryType}
                onChange={(e) => setTerritoryType(e.target.value as "exclusive" | "open" | "referral")}
                className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="exclusive">{t("superadmin.partner.territoryType.exclusive")}</option>
                <option value="open">{t("superadmin.partner.territoryType.open")}</option>
                <option value="referral">{t("superadmin.partner.territoryType.referral")}</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={submitting}
              className="rounded-lg bg-vbt-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50"
            >
              {submitting ? t("superadmin.partner.adding") : t("superadmin.partner.add")}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setErr(null); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {territories.length === 0 ? (
        <p className="text-sm text-gray-500">{t("superadmin.partner.detail.noTerritoriesYet")}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {territories.map((territory) => (
            <li key={territory.id} className="py-3 flex items-center justify-between">
              <span className="font-medium">{territory.countryCode}</span>
              {territory.region && <span className="text-gray-500">{territory.region}</span>}
              <span className="text-xs rounded bg-gray-100 px-2 py-0.5">
                {territoryTypeDisplay(t, territory.territoryType)}
              </span>
              <button
                type="button"
                onClick={() => setRemoveTerritoryId(territory.id)}
                className="text-sm text-red-600 hover:underline"
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<PlatformDefaults | null>(null);
  const [entryFeeUsd, setEntryFeeUsd] = useState<string>(profile?.entryFeeUsd != null ? String(profile.entryFeeUsd) : "");
  const [trainingFeeUsd, setTrainingFeeUsd] = useState<string>(profile?.trainingFeeUsd != null ? String(profile.trainingFeeUsd) : "");
  const [materialCreditUsd, setMaterialCreditUsd] = useState<string>(profile?.materialCreditUsd != null ? String(profile.materialCreditUsd) : "");
  const [engineeringFeeMode, setEngineeringFeeMode] = useState<string>(profile?.engineeringFeeMode ?? "");
  const [engineeringFeeValue, setEngineeringFeeValue] = useState<string>(profile?.engineeringFeeValue != null ? String(profile.engineeringFeeValue) : "");
  const [marginMinPct, setMarginMinPct] = useState<string>(profile?.marginMinPct != null ? String(profile.marginMinPct) : "");
  const [marginMaxPct, setMarginMaxPct] = useState<string>(profile?.marginMaxPct != null ? String(profile.marginMaxPct) : "");
  const [minimumPricePolicy, setMinimumPricePolicy] = useState<string>(profile?.minimumPricePolicy ?? "");
  const [salesTargetAnnualUsd, setSalesTargetAnnualUsd] = useState<string>(profile?.salesTargetAnnualUsd != null ? String(profile.salesTargetAnnualUsd) : "");
  const [salesTargetAnnualM2, setSalesTargetAnnualM2] = useState<string>(profile?.salesTargetAnnualM2 != null ? String(profile.salesTargetAnnualM2) : "");
  const [agreementStartDate, setAgreementStartDate] = useState<string>(profile?.agreementStartDate ? String(profile.agreementStartDate).slice(0, 10) : "");
  const [agreementEndDate, setAgreementEndDate] = useState<string>(profile?.agreementEndDate ? String(profile.agreementEndDate).slice(0, 10) : "");
  const [agreementStatus, setAgreementStatus] = useState<string>(profile?.agreementStatus ?? "");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        setError(data?.error ?? t("superadmin.partners.failedToSave"));
        return;
      }
      onSaved();
      setSuccessMessage(t("superadmin.partners.parametersSaved"));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setError(t("superadmin.partners.failedToSaveParameters"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
      <h3 className="text-lg font-medium text-gray-900">{t("superadmin.partner.detail.parametersTitle")}</h3>
      <p className="text-sm text-gray-500">
        {t("superadmin.partner.parametersIntro")}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">{t("superadmin.partner.detail.fees")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                {t("superadmin.partner.paramEntryFeeUsd")}
                {defaults?.pricing?.defaultEntryFeeUsd != null && entryFeeUsd === "" && (
                  <span className="ml-1 font-normal text-gray-400">
                    {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultEntryFeeUsd })}
                  </span>
                )}
              </label>
              <input type="text" inputMode="decimal" value={entryFeeUsd} onChange={(e) => setEntryFeeUsd(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                {t("superadmin.partner.paramTrainingFeeUsd")}
                {defaults?.pricing?.defaultTrainingFeeUsd != null && trainingFeeUsd === "" && (
                  <span className="ml-1 font-normal text-gray-400">
                    {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultTrainingFeeUsd })}
                  </span>
                )}
              </label>
              <input type="text" inputMode="decimal" value={trainingFeeUsd} onChange={(e) => setTrainingFeeUsd(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.materialCreditUsd")}</label>
              <input type="text" inputMode="decimal" value={materialCreditUsd} onChange={(e) => setMaterialCreditUsd(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.edit.engineeringFeeMode")}</label>
              <select value={engineeringFeeMode} onChange={(e) => setEngineeringFeeMode(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">{t("superadmin.partner.onboardingNotSet")}</option>
                {ENGINEERING_FEE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.engineeringFeeValue")}</label>
              <input type="text" inputMode="decimal" value={engineeringFeeValue} onChange={(e) => setEngineeringFeeValue(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t("superadmin.partner.detail.placeholderEngineeringFee")} />
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">{t("superadmin.partner.detail.marginsPricing")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                {t("superadmin.partner.paramMinMarginPct")}
                {defaults?.pricing?.defaultMarginMinPct != null && marginMinPct === "" && (
                  <span className="ml-1 font-normal text-gray-400">
                    {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultMarginMinPct })}
                  </span>
                )}
              </label>
              <input type="text" inputMode="decimal" value={marginMinPct} onChange={(e) => setMarginMinPct(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                {t("superadmin.partner.paramMaxMarginPct")}
                {defaults?.pricing?.defaultMarginMaxPct != null && marginMaxPct === "" && (
                  <span className="ml-1 font-normal text-gray-400">
                    {t("superadmin.partner.defaultValueInline", { value: defaults.pricing.defaultMarginMaxPct })}
                  </span>
                )}
              </label>
              <input type="text" inputMode="decimal" value={marginMaxPct} onChange={(e) => setMarginMaxPct(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.minimumPricePolicy")}</label>
              <input type="text" value={minimumPricePolicy} onChange={(e) => setMinimumPricePolicy(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t("superadmin.partner.detail.placeholderMinPricePolicy")} />
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">{t("superadmin.partner.detail.salesTargets")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.annualTargetUsd")}</label>
              <input type="text" inputMode="decimal" value={salesTargetAnnualUsd} onChange={(e) => setSalesTargetAnnualUsd(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.annualTargetM2")}</label>
              <input type="text" inputMode="decimal" value={salesTargetAnnualM2} onChange={(e) => setSalesTargetAnnualM2(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">{t("superadmin.partner.detail.agreement")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.startDate")}</label>
              <input type="date" value={agreementStartDate} onChange={(e) => setAgreementStartDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.endDate")}</label>
              <input type="date" value={agreementEndDate} onChange={(e) => setAgreementEndDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t("superadmin.partner.detail.status")}</label>
              <select value={agreementStatus} onChange={(e) => setAgreementStatus(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {AGREEMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || "_empty"} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50">
            {saving ? t("common.saving") : t("superadmin.partner.saveParameters")}
          </button>
        </div>
      </form>
    </div>
  );
}

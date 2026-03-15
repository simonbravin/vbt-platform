"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, MapPin, Mail } from "lucide-react";
import { useT } from "@/lib/i18n/context";

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
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {total} {total !== 1 ? t("superadmin.partners.countPlural") : t("superadmin.partners.count")}
        </p>
        <Link
          href="/superadmin/partners/new"
          className="inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-vbt-blue/90"
        >
          <Plus className="h-4 w-4" />
          {t("superadmin.partners.newPartner")}
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">{t("superadmin.partners.loading")}</div>
        ) : partners.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">{t("superadmin.partners.noPartnersYet")}</p>
            <p className="mt-1 text-sm text-gray-500">Create your first partner organization.</p>
            <Link
              href="/superadmin/partners/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90"
            >
              <Plus className="h-4 w-4" />
              New partner
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Onboarding
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/superadmin/partners/${p.id}`}
                        className="font-medium text-gray-900 hover:text-vbt-blue flex items-center gap-2"
                      >
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {p.name}
                      </Link>
                      {p.countryCode && (
                        <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.countryCode}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {p.partnerProfile?.partnerType?.replace("_", " ") ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {p.partnerProfile?.contactName ?? p.partnerProfile?.contactEmail ?? "—"}
                      {p.partnerProfile?.contactEmail && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {p.partnerProfile.contactEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {p.partnerProfile?.onboardingState?.replace(/_/g, " ") ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {p.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/superadmin/partners/${p.id}`}
                        className="text-sm font-medium text-vbt-blue hover:underline"
                      >
                        Manage
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useT } from "@/lib/i18n/context";

type Cert = {
  id: string;
  type: string;
  titleSnapshot: string;
  issuedAt: string;
  user?: { id: string; fullName: string | null; email: string | null };
  organization?: { id: string; name: string };
};

export function TrainingCertificatesAdminClient() {
  const t = useT();
  const [certificates, setCertificates] = useState<Cert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    if (organizationId.trim()) p.set("organizationId", organizationId.trim());
    if (userId.trim()) p.set("userId", userId.trim());
    return p.toString();
  }, [organizationId, userId, offset]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/saas/training/certificates?${queryString}`);
    if (!r.ok) {
      setCertificates([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const data = await r.json();
    setCertificates(data.certificates ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [organizationId, userId]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/superadmin/training"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← {t("nav.superadmin.training")}
      </Link>

      <form onSubmit={applyFilters} className="surface-card p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("superadmin.certificates.filterOrg")}</label>
          <input
            className="input-native w-full"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="organization id"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("superadmin.certificates.filterUser")}</label>
          <input
            className="input-native w-full"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user id"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50"
          >
            {t("superadmin.quizzes.attempts.apply")}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : certificates.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("superadmin.certificates.empty")}</div>
      ) : (
        <div className="surface-card-overflow">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.certificates.colIssued")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.certificates.colPartner")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.certificates.colUser")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.certificates.colTitle")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.certificates.colType")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.certificates.colPdf")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {certificates.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{format(new Date(c.issuedAt), "PPp")}</td>
                  <td className="px-5 py-3 text-sm">{c.organization?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-sm">{c.user?.fullName ?? c.user?.email ?? "—"}</td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{c.titleSnapshot}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{c.type}</td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href={`/api/saas/training/certificates/${c.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t("partner.training.downloadPdf")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border/60 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {t("superadmin.quizzes.attempts.pageSummary", {
                from: String(offset + 1),
                to: String(offset + certificates.length),
                total: String(total),
              })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                className="text-sm font-medium text-primary disabled:opacity-40"
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                {t("superadmin.quizzes.attempts.prev")}
              </button>
              <button
                type="button"
                disabled={offset + certificates.length >= total}
                className="text-sm font-medium text-primary disabled:opacity-40"
                onClick={() => setOffset((o) => o + limit)}
              >
                {t("superadmin.quizzes.attempts.next")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useT } from "@/lib/i18n/context";

type AttemptRow = {
  id: string;
  submittedAt: string | null;
  scorePct: number | null;
  passed: boolean | null;
  quizDefinition?: { id: string; title: string };
  user?: { id: string; fullName: string | null; email: string | null };
  organization?: { id: string; name: string };
};

type Def = { id: string; title: string };

export function QuizAttemptsAdminClient() {
  const t = useT();
  const searchParams = useSearchParams();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [defs, setDefs] = useState<Def[]>([]);
  const [loading, setLoading] = useState(true);

  const initialQuizDefId = searchParams.get("quizDefinitionId") ?? "";
  const [quizDefinitionId, setQuizDefinitionId] = useState(initialQuizDefId);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    setQuizDefinitionId(initialQuizDefId);
  }, [initialQuizDefId]);

  useEffect(() => {
    setOffset(0);
  }, [quizDefinitionId, organizationId, userId]);

  useEffect(() => {
    fetch("/api/saas/quizzes/definitions")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDefs(Array.isArray(d) ? d : []));
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    if (quizDefinitionId.trim()) p.set("quizDefinitionId", quizDefinitionId.trim());
    if (organizationId.trim()) p.set("organizationId", organizationId.trim());
    if (userId.trim()) p.set("userId", userId.trim());
    return p.toString();
  }, [quizDefinitionId, organizationId, userId, offset]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/saas/quizzes/attempts?${queryString}`);
    if (!r.ok) {
      setAttempts([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const data = await r.json();
    setAttempts(data.attempts ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/superadmin/quizzes"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← {t("superadmin.quizzes.hub.back")}
      </Link>

      <form onSubmit={applyFilters} className="surface-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("superadmin.quizzes.attempts.filterQuiz")}</label>
          <select
            className="input-native w-full"
            value={quizDefinitionId}
            onChange={(e) => setQuizDefinitionId(e.target.value)}
          >
            <option value="">{t("superadmin.quizzes.attempts.any")}</option>
            {defs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("superadmin.quizzes.attempts.filterOrg")}</label>
          <input
            className="input-native w-full"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="org id"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("superadmin.quizzes.attempts.filterUser")}</label>
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
      ) : attempts.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("superadmin.quizzes.attempts.empty")}</div>
      ) : (
        <div className="surface-card-overflow">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.attempts.colSubmitted")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.attempts.colPartner")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.attempts.colUser")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.attempts.colQuiz")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.attempts.colScore")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.attempts.colPassed")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {a.submittedAt ? format(new Date(a.submittedAt), "PPp") : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm">{a.organization?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-sm">
                    {a.user?.fullName ?? a.user?.email ?? a.user?.id ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm">{a.quizDefinition?.title ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-sm">{a.scorePct != null ? `${a.scorePct}` : "—"}</td>
                  <td className="px-5 py-3 text-right text-sm">
                    {a.passed == null ? "—" : a.passed ? t("partner.training.quizPassed") : t("partner.training.quizFailed")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border/60 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {t("superadmin.quizzes.attempts.pageSummary", {
                from: String(offset + 1),
                to: String(offset + attempts.length),
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
                disabled={offset + attempts.length >= total}
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

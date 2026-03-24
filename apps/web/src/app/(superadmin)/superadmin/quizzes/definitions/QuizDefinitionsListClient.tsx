"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

type Def = {
  id: string;
  title: string;
  status: string;
  passingScorePct: number;
  _count?: { attempts: number };
};

function statusLabel(t: (k: string) => string, status: string) {
  const key = `superadmin.quizzes.status.${status}`;
  const out = t(key);
  return out === key ? status : out;
}

export function QuizDefinitionsListClient() {
  const t = useT();
  const [defs, setDefs] = useState<Def[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/saas/quizzes/definitions")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDefs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/superadmin/quizzes"
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          ← {t("superadmin.quizzes.hub.back")}
        </Link>
        <Link
          href="/superadmin/quizzes/definitions/new"
          className="inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {t("superadmin.quizzes.definitions.new")}
        </Link>
      </div>

      {defs.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("superadmin.quizzes.empty")}</div>
      ) : (
        <div className="surface-card-overflow">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.colTitle")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.colStatus")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.colPassing")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.colAttempts")}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  {t("superadmin.quizzes.colActions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {defs.map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{d.title}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{statusLabel(t, d.status)}</td>
                  <td className="px-5 py-3 text-right text-sm text-muted-foreground">{d.passingScorePct}</td>
                  <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                    {d._count?.attempts ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right text-sm space-x-3 whitespace-nowrap">
                    <Link href={`/superadmin/quizzes/definitions/${d.id}`} className="font-medium text-primary hover:underline">
                      {t("common.edit")}
                    </Link>
                    <Link
                      href={`/superadmin/quizzes/attempts?quizDefinitionId=${encodeURIComponent(d.id)}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {t("superadmin.quizzes.attempts.link")}
                    </Link>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, CheckCircle, UserPlus } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Program = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  status: string;
  _count?: { enrollments: number };
};

type Enrollment = {
  id: string;
  status: string;
  progressPct: number;
  trainingProgram?: { id: string; title: string };
  completedAt: string | null;
};

export function TrainingPartnerClient() {
  const t = useT();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    return Promise.all([
      fetch("/api/saas/training/programs").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/saas/training/enrollments?limit=50").then((r) => (r.ok ? r.json() : { enrollments: [] })),
    ]).then(([progs, enrollData]) => {
      setPrograms(Array.isArray(progs) ? progs : []);
      setEnrollments(enrollData?.enrollments ?? []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .catch(() => { if (!cancelled) setError(t("partner.training.failedToLoad")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchData, t]);

  const isEnrolled = (programId: string) => enrollments.some((e) => e.trainingProgram?.id === programId);

  const handleEnroll = async (programId: string) => {
    setEnrollingId(programId);
    try {
      const res = await fetch("/api/saas/training/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId }),
      });
      if (res.ok) await fetchData();
    } finally {
      setEnrollingId(null);
    }
  };

  if (loading) return <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (error) return <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground">{error}</div>;

  return (
    <div className="space-y-8">
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.myEnrollments")}</h2>
        </div>
        {enrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("partner.training.notEnrolledYet")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {enrollments.map((e) => (
              <li key={e.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground/70" />
                  <div>
                    <p className="font-medium text-foreground">{e.trainingProgram?.title ?? t("partner.training.programFallback")}</p>
                    <p className="text-sm text-muted-foreground">{e.status} · {e.progressPct}%</p>
                  </div>
                </div>
                {e.completedAt && <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.availablePrograms")}</h2>
        </div>
        {programs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("partner.training.noProgramsAvailable")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {programs.map((p) => {
              const enrolled = isEnrolled(p.id);
              return (
                <li key={p.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{p.title}</p>
                    {p.description && <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>}
                    {p.level && (
                      <p className="text-xs text-muted-foreground/70 mt-1">{t("partner.training.levelLabel", { level: p.level })}</p>
                    )}
                  </div>
                  {!enrolled && (
                    <button
                      type="button"
                      onClick={() => handleEnroll(p.id)}
                      disabled={enrollingId === p.id}
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-sm border border-primary/20 bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      {enrollingId === p.id ? t("partner.training.enrolling") : t("partner.training.enroll")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

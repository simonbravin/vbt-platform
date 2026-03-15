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

  if (loading) return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">{error}</div>;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">My enrollments</h2>
        </div>
        {enrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">You are not enrolled in any program yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {enrollments.map((e) => (
              <li key={e.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{e.trainingProgram?.title ?? "Program"}</p>
                    <p className="text-sm text-gray-500">{e.status} · {e.progressPct}%</p>
                  </div>
                </div>
                {e.completedAt && <CheckCircle className="h-5 w-5 text-green-500" />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Available programs</h2>
        </div>
        {programs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No programs available.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {programs.map((p) => {
              const enrolled = isEnrolled(p.id);
              return (
                <li key={p.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{p.title}</p>
                    {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
                    {p.level && <p className="text-xs text-gray-400 mt-1">Level: {p.level}</p>}
                  </div>
                  {!enrolled && (
                    <button
                      type="button"
                      onClick={() => handleEnroll(p.id)}
                      disabled={enrollingId === p.id}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-vbt-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      {enrollingId === p.id ? "Enrolling..." : "Enroll"}
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

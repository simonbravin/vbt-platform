"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type TrainingProgram = {
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
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  user?: { id: string; fullName: string | null; email: string | null };
  trainingProgram?: { id: string; title: string; durationHours: number | null };
  organization?: { id: string; name: string };
};

export function TrainingAdminClient() {
  const t = useT();
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsTotal, setEnrollmentsTotal] = useState(0);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrograms() {
      try {
        const res = await fetch("/api/saas/training/programs");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPrograms(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError(t("superadmin.training.failedToLoadPrograms"));
      } finally {
        if (!cancelled) setLoadingPrograms(false);
      }
    }
    fetchPrograms();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchEnrollments() {
      try {
        const res = await fetch("/api/saas/training/enrollments?limit=100");
        if (!res.ok) {
          if (!cancelled) setError(t("superadmin.training.failedToLoadEnrollments"));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setEnrollments(data.enrollments ?? []);
          setEnrollmentsTotal(data.total ?? 0);
        }
      } catch {
        if (!cancelled) setError(t("superadmin.training.failedToLoadEnrollments"));
      } finally {
        if (!cancelled) setLoadingEnrollments(false);
      }
    }
    fetchEnrollments();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">{t("superadmin.training.programs")}</h2>
        </div>
        {loadingPrograms ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("common.loading")}</div>
        ) : programs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("superadmin.training.noProgramsYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollments</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{p.title}</p>
                      {p.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{p.level ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{p.status}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{p._count?.enrollments ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">{t("superadmin.training.enrollments")}</h2>
        </div>
        {loadingEnrollments ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("common.loading")}</div>
        ) : enrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("superadmin.training.noEnrollmentsYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-900">
                      {e.user?.fullName ?? e.user?.email ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{e.trainingProgram?.title ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{e.organization?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{e.status}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-600">{e.progressPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingEnrollments && enrollments.length > 0 && (
          <p className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100">{enrollmentsTotal} enrollment(s)</p>
        )}
      </div>
    </div>
  );
}

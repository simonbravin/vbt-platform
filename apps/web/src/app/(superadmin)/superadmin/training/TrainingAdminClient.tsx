"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const KNOWN_PROGRAM_STATUSES = ["active", "inactive", "draft", "archived", "published"] as const;
const KNOWN_ENROLLMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;

function programStatusLabel(t: (key: string) => string, status: string): string {
  if ((KNOWN_PROGRAM_STATUSES as readonly string[]).includes(status)) {
    return t(`superadmin.training.programStatus.${status}`);
  }
  return status;
}

function enrollmentStatusLabel(t: (key: string) => string, status: string): string {
  if ((KNOWN_ENROLLMENT_STATUSES as readonly string[]).includes(status)) {
    return t(`superadmin.training.enrollmentStatus.${status}`);
  }
  return status;
}

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
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

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
  }, [t]);

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
  }, [t]);

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch("/api/saas/training/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: "active", publishedAt: new Date().toISOString() }),
      });
      if (res.ok) {
        setNewTitle("");
        const listRes = await fetch("/api/saas/training/programs");
        if (listRes.ok) {
          const data = await listRes.json();
          setPrograms(Array.isArray(data) ? data : []);
        }
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreateProgram} className="surface-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">
            {t("superadmin.training.createProgram")}
          </label>
          <input
            className="input-native mt-1 w-full"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("superadmin.training.createProgramPlaceholder")}
          />
        </div>
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("superadmin.training.createProgram")}
        </button>
      </form>

      {error && (
        <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-4 text-sm text-foreground">
          {error}
        </div>
      )}

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.training.programs")}</h2>
        </div>
        {loadingPrograms ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : programs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("superadmin.training.noProgramsYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colTitle")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colLevel")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colStatus")}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colEnrollments")}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.manageSessions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{p.title}</p>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{p.level ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{programStatusLabel(t, p.status)}</td>
                    <td className="px-5 py-3 text-right text-sm text-muted-foreground">{p._count?.enrollments ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/superadmin/training/programs/${p.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t("superadmin.training.manageSessions")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.training.enrollments")}</h2>
        </div>
        {loadingEnrollments ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : enrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("superadmin.training.noEnrollmentsYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colUser")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colProgram")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colPartner")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colStatus")}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("superadmin.training.colProgress")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3 text-sm text-foreground">
                      {e.user?.fullName ?? e.user?.email ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{e.trainingProgram?.title ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{e.organization?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{enrollmentStatusLabel(t, e.status)}</td>
                    <td className="px-5 py-3 text-right text-sm text-muted-foreground">{e.progressPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingEnrollments && enrollments.length > 0 && (
          <p className="px-5 py-2 text-xs text-muted-foreground border-t border-border/60">
            {t("superadmin.training.enrollmentsTotal", { count: enrollmentsTotal })}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

type SessionRow = {
  id: string;
  title: string;
  startsAt: string;
  meetingUrl: string | null;
  status: string;
  _count?: { enrollments: number };
};

type RegRow = {
  id: string;
  status: string;
  user?: { fullName: string | null; email: string | null };
  organization?: { name: string };
};

export function TrainingProgramSessionsClient({ programId }: { programId: string }) {
  const t = useT();
  const { toast } = useToast();
  const [programTitle, setProgramTitle] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", startsAt: "", meetingUrl: "" });

  const loadSessions = useCallback(async () => {
    const res = await fetch(`/api/saas/training/programs/${programId}/sessions`);
    if (res.ok) {
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    }
  }, [programId]);

  useEffect(() => {
    let c = false;
    (async () => {
      const pr = await fetch(`/api/saas/training/programs/${programId}`);
      if (pr.ok) {
        const p = await pr.json();
        if (!c) setProgramTitle(p.title ?? "");
      }
      await loadSessions();
      if (!c) setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [programId, loadSessions]);

  async function loadRegs(sessionId: string) {
    const res = await fetch(`/api/saas/training/sessions/${sessionId}/enrollments?limit=200`);
    if (res.ok) {
      const data = await res.json();
      setRegs(data.enrollments ?? []);
    }
  }

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startsAt) return;
    const res = await fetch(`/api/saas/training/programs/${programId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        meetingUrl: form.meetingUrl.trim() || null,
      }),
    });
    if (res.ok) {
      setForm({ title: "", startsAt: "", meetingUrl: "" });
      await loadSessions();
      toast({ title: t("superadmin.training.toast.sessionCreated") });
    } else {
      toast({
        title: t("superadmin.training.toast.sessionCreateError"),
        variant: "destructive",
      });
    }
  }

  async function markAttendance(enrollmentId: string, status: "attended" | "no_show") {
    const res = await fetch(`/api/saas/training/session-enrollments/${enrollmentId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast({ title: t("superadmin.training.toast.attendanceSaved") });
    } else {
      toast({
        title: t("superadmin.training.toast.attendanceError"),
        variant: "destructive",
      });
    }
    if (expanded) await loadRegs(expanded);
  }

  if (loading) {
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/superadmin/training"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← {t("nav.superadmin.training")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{programTitle}</h1>
      <p className="text-sm text-muted-foreground">
        <Link href="/superadmin/documents" className="font-medium text-primary hover:underline">
          {t("superadmin.training.studyMaterialsAdminLink")}
        </Link>{" "}
        {t("superadmin.training.studyMaterialsAdminHint")}
      </p>

      <form onSubmit={addSession} className="surface-card p-4 space-y-3 max-w-lg">
        <h2 className="font-medium text-foreground">{t("superadmin.training.addSession")}</h2>
        <input
          className="input-native w-full"
          placeholder={t("superadmin.training.colTitle")}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <input
          type="datetime-local"
          className="input-native w-full"
          value={form.startsAt}
          onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground mt-1">{t("superadmin.training.startsAt")}</p>
        <input
          className="input-native w-full"
          placeholder={t("superadmin.training.meetingUrl")}
          value={form.meetingUrl}
          onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
        />
        <button type="submit" className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {t("superadmin.training.addSession")}
        </button>
      </form>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold">{t("superadmin.training.sessionsTitle")}</h2>
        </div>
        <ul className="divide-y divide-border/60">
          {sessions.map((s) => (
            <li key={s.id} className="px-5 py-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  if (expanded === s.id) {
                    setExpanded(null);
                  } else {
                    setExpanded(s.id);
                    void loadRegs(s.id);
                  }
                }}
              >
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(s.startsAt), "PPp")} · {s.status} · {s._count?.enrollments ?? 0}{" "}
                  {t("superadmin.training.sessionEnrollments").toLowerCase()}
                </p>
              </button>
              {expanded === s.id && (
                <div className="mt-3 pl-3 border-l border-border/60 space-y-2">
                  {regs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("superadmin.training.noRegistrationsForSession")}
                    </p>
                  ) : (
                    regs.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          {r.user?.fullName ?? r.user?.email ?? r.id}{" "}
                          <span className="text-muted-foreground">({r.organization?.name ?? "—"})</span> ·{" "}
                          {r.status}
                        </span>
                        {r.status === "registered" && (
                          <span className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-primary"
                              onClick={() => void markAttendance(r.id, "attended")}
                            >
                              {t("superadmin.training.markAttended")}
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-muted-foreground"
                              onClick={() => void markAttendance(r.id, "no_show")}
                            >
                              {t("superadmin.training.markNoShow")}
                            </button>
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {sessions.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("superadmin.training.noSessionsInProgram")}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle, UserPlus, Video, ClipboardList, Award } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { format } from "date-fns";

function apiErrorString(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as { error?: unknown };
  if (typeof o.error === "string") return o.error;
  if (
    o.error &&
    typeof o.error === "object" &&
    "message" in o.error &&
    typeof (o.error as { message: unknown }).message === "string"
  ) {
    return (o.error as { message: string }).message;
  }
  return undefined;
}

type Program = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  status: string;
  _count?: { enrollments: number; liveSessions?: number };
};

type LiveSession = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  meetingUrl: string | null;
  status: string;
};

type Enrollment = {
  id: string;
  status: string;
  progressPct: number;
  trainingProgram?: { id: string; title: string };
  completedAt: string | null;
};

type SessionEnrollment = {
  id: string;
  status: string;
  liveSessionId: string;
  liveSession?: { id: string; title: string; startsAt: string; meetingUrl: string | null };
};

type QuizDef = {
  id: string;
  title: string;
  status: string;
  passingScorePct: number;
};

type QuizQuestionClient = {
  qKey: string;
  stem: string;
  options: { oKey: string; text: string }[];
};

type CertRow = {
  id: string;
  type: string;
  titleSnapshot: string;
  issuedAt: string;
};

type QuizAttemptHistory = {
  id: string;
  submittedAt: string | null;
  scorePct: number | null;
  passed: boolean | null;
  quizDefinition?: { id: string; title: string; passingScorePct: number };
};

export function TrainingPartnerClient() {
  const t = useT();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessionsByProgram, setSessionsByProgram] = useState<Record<string, LiveSession[]>>({});
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [liveRegs, setLiveRegs] = useState<SessionEnrollment[]>([]);
  const [quizzes, setQuizzes] = useState<QuizDef[]>([]);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollingSessionId, setEnrollingSessionId] = useState<string | null>(null);

  const [activeQuiz, setActiveQuiz] = useState<{
    attemptId: string;
    questions: QuizQuestionClient[];
  } | null>(null);
  const [quizSelections, setQuizSelections] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{
    scorePct: number;
    passed: boolean;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const liveRegBySessionId = useMemo(() => {
    const m = new Map<string, SessionEnrollment>();
    for (const r of liveRegs) {
      if (r.status !== "cancelled") m.set(r.liveSessionId, r);
    }
    return m;
  }, [liveRegs]);

  const activeLiveRegs = useMemo(
    () => liveRegs.filter((r) => r.status !== "cancelled"),
    [liveRegs]
  );

  const showProgramsBlock = programs.length > 0;
  const showLiveRegsBlock = activeLiveRegs.length > 0;
  const showEnrollmentsBlock = enrollments.length > 0;
  const showQuizzesBlock = quizzes.length > 0;
  const showQuizHistoryBlock = quizAttempts.length > 0;
  const showCertsBlock = certs.length > 0;

  const hasMainTrainingContent =
    showProgramsBlock ||
    showLiveRegsBlock ||
    showEnrollmentsBlock ||
    showQuizzesBlock ||
    showQuizHistoryBlock ||
    showCertsBlock;

  function sessionRegStatusLabel(status: string): string {
    if (status === "attended") return t("partner.training.sessionRegStatus.attended");
    if (status === "no_show") return t("partner.training.sessionRegStatus.no_show");
    if (status === "registered") return t("partner.training.sessionEnrolled");
    return status;
  }

  const fetchData = useCallback(async () => {
    const [progs, enrollData, liveData, quizData, certData, attemptData] = await Promise.all([
      fetch("/api/saas/training/programs?includeSessions=1").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/saas/training/enrollments?limit=50").then((r) =>
        r.ok ? r.json() : { enrollments: [] }
      ),
      fetch("/api/saas/training/my-live-enrollments?limit=100").then((r) =>
        r.ok ? r.json() : { enrollments: [] }
      ),
      fetch("/api/saas/quizzes/definitions").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/saas/training/my-certificates?limit=50").then((r) =>
        r.ok ? r.json() : { certificates: [] }
      ),
      fetch("/api/saas/quizzes/my-attempts?limit=50").then((r) =>
        r.ok ? r.json() : { attempts: [] }
      ),
    ]);
    const programList = Array.isArray(progs) ? progs : [];
    setPrograms(programList);
    setEnrollments(enrollData?.enrollments ?? []);
    setLiveRegs(liveData?.enrollments ?? []);
    setQuizzes(Array.isArray(quizData) ? quizData : []);
    setCerts(certData?.certificates ?? []);
    setQuizAttempts(attemptData?.attempts ?? []);

    const entries = programList.map((p: Program & { sessions?: LiveSession[] }) => {
      const sessions = Array.isArray(p.sessions) ? p.sessions : [];
      return [p.id, sessions] as const;
    });
    setSessionsByProgram(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .catch(() => {
        if (!cancelled) setError(t("partner.training.failedToLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchData, t]);

  const isEnrolled = (programId: string) => enrollments.some((e) => e.trainingProgram?.id === programId);

  const handleEnrollProgram = async (programId: string) => {
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

  const handleEnrollSession = async (sessionId: string) => {
    setActionError(null);
    setEnrollingSessionId(sessionId);
    try {
      const res = await fetch(`/api/saas/training/sessions/${sessionId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = res.ok ? null : await res.json().catch(() => ({}));
      if (res.ok) await fetchData();
      else setActionError((body as { error?: string })?.error ?? t("partner.training.sessionCouldNotEnroll"));
    } finally {
      setEnrollingSessionId(null);
    }
  };

  const handleCancelSession = async (enrollmentId: string) => {
    await fetch(`/api/saas/training/session-enrollments/${enrollmentId}`, { method: "PATCH" });
    await fetchData();
  };

  const handleStartQuiz = async (quizId: string) => {
    setActionError(null);
    setQuizResult(null);
    const res = await fetch(`/api/saas/quizzes/definitions/${quizId}/start`, { method: "POST" });
    const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = (data as { code?: string }).code;
      setActionError(
        code === "QUIZ_INSUFFICIENT_PUBLISHED_QUESTIONS"
          ? t("partner.training.quizInsufficientPublished")
          : apiErrorString(data) ?? t("partner.training.quizCouldNotStart")
      );
      return;
    }
    setActiveQuiz({
      attemptId: data.attemptId,
      questions: data.snapshotForClient?.questions ?? [],
    });
    setQuizSelections({});
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setActionError(null);
    const unanswered = activeQuiz.questions.some((q) => !quizSelections[q.qKey]);
    if (unanswered) {
      setActionError(t("partner.training.quizAnswerAll"));
      return;
    }
    const res = await fetch(`/api/saas/quizzes/attempts/${activeQuiz.attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: quizSelections }),
    });
    const attempt = res.ok ? await res.json() : await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(apiErrorString(attempt) ?? t("partner.training.quizSubmitError"));
      return;
    }
    setQuizResult({ scorePct: attempt.scorePct ?? 0, passed: !!attempt.passed });
    setActiveQuiz(null);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-alert-warningBorder bg-alert-warning p-6 text-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {actionError && (
        <div
          className="rounded-lg border border-alert-warningBorder bg-alert-warning/90 px-4 py-3 text-sm text-foreground flex justify-between gap-4 items-start"
          role="alert"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {activeQuiz && (
        <div className="surface-card-overflow border border-primary/25 shadow-sm">
          <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t("partner.training.quizInProgressTitle")}</h2>
          </div>
          <div className="p-5 space-y-6">
            {activeQuiz.questions.map((q) => (
              <div key={q.qKey}>
                <p className="font-medium text-foreground">{q.stem}</p>
                <ul className="mt-2 space-y-2">
                  {q.options.map((o) => (
                    <li key={o.oKey}>
                      <label className="flex items-start gap-2.5 text-sm cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted/50">
                        <input
                          type="radio"
                          name={q.qKey}
                          checked={quizSelections[q.qKey] === o.oKey}
                          onChange={() => setQuizSelections((s) => ({ ...s, [q.qKey]: o.oKey }))}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <span>{o.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button
              type="button"
              onClick={() => void handleSubmitQuiz()}
              className="inline-flex items-center rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("partner.training.submitQuiz")}
            </button>
          </div>
        </div>
      )}

      {quizResult && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm surface-card">
          <p className="font-medium text-foreground">
            {t("partner.training.quizScore", { score: String(quizResult.scorePct) })}{" "}
            — {quizResult.passed ? t("partner.training.quizPassed") : t("partner.training.quizFailed")}
          </p>
        </div>
      )}

      {showProgramsBlock && (
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.availablePrograms")}</h2>
        </div>
          <ul className="divide-y divide-border/60">
            {programs.map((p) => {
              const enrolled = isEnrolled(p.id);
              const sessions = sessionsByProgram[p.id] ?? [];
              return (
                <li key={p.id} className="px-5 py-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{p.title}</p>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>
                      )}
                      {p.level && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {t("partner.training.levelLabel", { level: p.level })}
                        </p>
                      )}
                      <Link
                        href="/documents?categoryCode=training"
                        className="text-xs text-primary hover:underline mt-2 inline-block"
                      >
                        {t("partner.training.studyMaterialsCta")}
                      </Link>
                    </div>
                    {!enrolled && (
                      <button
                        type="button"
                        onClick={() => void handleEnrollProgram(p.id)}
                        disabled={enrollingId === p.id}
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        {enrollingId === p.id ? t("partner.training.enrolling") : t("partner.training.enroll")}
                      </button>
                    )}
                  </div>
                  <div className="pl-1 border-l-2 border-border/60 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      {t("partner.training.liveSessionsHeading")}
                    </p>
                    {sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("partner.training.noSessions")}</p>
                    ) : (
                      <ul className="space-y-3">
                        {sessions.map((s) => {
                          const reg = liveRegBySessionId.get(s.id);
                          const showLink = s.meetingUrl && reg && reg.status !== "cancelled";
                          return (
                            <li
                              key={s.id}
                              className="rounded-lg bg-muted/40 px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                            >
                              <div>
                                <p className="font-medium text-foreground">{s.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t("partner.training.sessionWhen", {
                                    when: format(new Date(s.startsAt), "PPp"),
                                  })}
                                </p>
                                {showLink && (
                                  <a
                                    href={s.meetingUrl!}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary hover:underline mt-1 inline-block"
                                  >
                                    {t("partner.training.meetingLink")}
                                  </a>
                                )}
                              </div>
                              <div>
                                {reg && reg.status === "registered" ? (
                                  <span className="text-xs font-medium text-primary">
                                    {t("partner.training.sessionEnrolled")}
                                  </span>
                                ) : reg && (reg.status === "attended" || reg.status === "no_show") ? (
                                  <span className="text-xs text-muted-foreground">
                                    {sessionRegStatusLabel(reg.status)}
                                  </span>
                                ) : s.status !== "cancelled" ? (
                                  <button
                                    type="button"
                                    disabled={enrollingSessionId === s.id}
                                    onClick={() => void handleEnrollSession(s.id)}
                                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted/60"
                                  >
                                    {enrollingSessionId === s.id
                                      ? t("common.loading")
                                      : t("partner.training.enrollSession")}
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
      </div>
      )}

      {showLiveRegsBlock && (
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.myLiveRegistrations")}</h2>
        </div>
          <ul className="divide-y divide-border/60">
            {activeLiveRegs.map((r) => (
                <li key={r.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{r.liveSession?.title ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.liveSession?.startsAt
                        ? format(new Date(r.liveSession.startsAt), "PPp")
                        : ""}{" "}
                      · {sessionRegStatusLabel(r.status)}
                    </p>
                  </div>
                  {r.status === "registered" && (
                    <button
                      type="button"
                      onClick={() => void handleCancelSession(r.id)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t("partner.training.cancelSessionReg")}
                    </button>
                  )}
                </li>
              ))}
          </ul>
      </div>
      )}

      {showEnrollmentsBlock && (
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.myEnrollments")}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t("partner.training.programInterestHint")}</p>
        </div>
          <ul className="divide-y divide-border/60">
            {enrollments.map((e) => (
              <li key={e.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground/70" />
                  <div>
                    <p className="font-medium text-foreground">
                      {e.trainingProgram?.title ?? t("partner.training.programFallback")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {e.status} · {e.progressPct}%
                    </p>
                  </div>
                </div>
                {e.completedAt && <CheckCircle className="h-5 w-5 text-primary" />}
              </li>
            ))}
          </ul>
      </div>
      )}

      {showQuizzesBlock && (
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.quizzesHeading")}</h2>
        </div>
          <ul className="divide-y divide-border/60">
            {quizzes.map((q) => (
              <li key={q.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{q.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("partner.training.quizPassingThreshold", { pct: String(q.passingScorePct) })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!!activeQuiz}
                  onClick={() => void handleStartQuiz(q.id)}
                  className="rounded-lg border border-primary/25 bg-card px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted/50 disabled:opacity-50"
                >
                  {t("partner.training.startQuiz")}
                </button>
              </li>
            ))}
          </ul>
      </div>
      )}

      {showQuizHistoryBlock && (
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.quizHistoryHeading")}</h2>
        </div>
          <ul className="divide-y divide-border/60">
            {quizAttempts.map((a) => (
              <li key={a.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {a.quizDefinition?.title ?? t("partner.training.quizHistoryTitleFallback")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.submittedAt
                      ? t("partner.training.quizHistoryWhen", {
                          when: format(new Date(a.submittedAt), "PPp"),
                        })
                      : "—"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {a.scorePct != null ? t("partner.training.quizScore", { score: String(a.scorePct) }) : "—"}{" "}
                  {a.passed != null
                    ? a.passed
                      ? `· ${t("partner.training.quizPassed")}`
                      : `· ${t("partner.training.quizFailed")}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
      </div>
      )}

      {showCertsBlock && (
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Award className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t("partner.training.certificatesHeading")}</h2>
        </div>
          <ul className="divide-y divide-border/60">
            {certs.map((c) => (
              <li key={c.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{c.titleSnapshot}</p>
                  <p className="text-xs text-muted-foreground">{c.issuedAt?.slice(0, 10)}</p>
                </div>
                <a
                  href={`/api/saas/training/certificates/${c.id}/pdf`}
                  className="text-sm font-medium text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("partner.training.downloadPdf")}
                </a>
              </li>
            ))}
          </ul>
      </div>
      )}

      {!hasMainTrainingContent && !activeQuiz && !quizResult && (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground max-w-lg mx-auto">
          {t("partner.training.pageNothingToShow")}
        </div>
      )}
    </div>
  );
}

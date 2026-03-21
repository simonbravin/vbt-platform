"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Wrench } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const ENGINEERING_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "pending_info",
  "needs_info",
  "in_progress",
  "completed",
  "delivered",
  "rejected",
] as const;

type ReviewEvent = {
  id: string;
  body: string;
  visibility: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  authorUser?: { id: string; fullName: string | null; email: string | null } | null;
};

type RequestDetail = {
  id: string;
  requestNumber: string;
  status: string;
  projectId: string;
  organizationId?: string;
  notes?: string | null;
  project?: { id: string; projectName: string; countryCode?: string | null };
  organization?: { id: string; name: string } | null;
  requestedByUser?: { id: string; fullName: string | null } | null;
  assignedToUser?: { id: string; fullName: string | null } | null;
  reviewEvents?: ReviewEvent[];
  files?: { id: string; fileName: string }[];
  deliverables?: { id: string; title?: string | null; fileUrl?: string | null }[];
  createdAt: string;
};

export function SuperadminEngineeringDetailClient({ requestId }: { requestId: string }) {
  const t = useT();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusEdit, setStatusEdit] = useState("");
  const [assignedEdit, setAssignedEdit] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"partner" | "internal">("partner");
  const [noteToStatus, setNoteToStatus] = useState<string>("");
  const [postingNote, setPostingNote] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/saas/engineering/${requestId}`)
      .then(async (r) => {
        const data = r.ok ? await r.json() : null;
        if (!r.ok || !data) {
          setError(t("superadmin.engineeringDetail.failedLoad"));
          setRequest(null);
          return;
        }
        setRequest(data);
        setStatusEdit(data.status ?? "");
        setAssignedEdit(data.assignedToUser?.id ?? "");
      })
      .catch(() => {
        setError(t("superadmin.engineeringDetail.failedLoad"));
        setRequest(null);
      })
      .finally(() => setLoading(false));
  }, [requestId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const saveHeader = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { status: statusEdit };
      if (assignedEdit.trim()) body.assignedToUserId = assignedEdit.trim();
      else body.assignedToUserId = null;
      const res = await fetch(`/api/saas/engineering/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? t("superadmin.engineeringDetail.saveFailed"));
        return;
      }
      const data = await res.json();
      setRequest((prev) => (prev ? { ...prev, ...data } : data));
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  const postNote = async () => {
    if (!noteBody.trim()) return;
    setPostingNote(true);
    setError(null);
    try {
      const body: { body: string; visibility: string; toStatus?: string } = {
        body: noteBody.trim(),
        visibility: noteVisibility,
      };
      if (noteToStatus) body.toStatus = noteToStatus;
      const res = await fetch(`/api/saas/engineering/${requestId}/review-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : t("superadmin.engineeringDetail.noteFailed"));
        return;
      }
      setRequest(data);
      setNoteBody("");
      setNoteToStatus("");
    } finally {
      setPostingNote(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (error && !request) {
    return <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-6 text-sm text-foreground">{error}</div>;
  }
  if (!request) return null;

  const events = request.reviewEvents ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-foreground">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Wrench className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{request.requestNumber}</h1>
              <p className="text-sm text-muted-foreground">{request.organization?.name ?? "—"}</p>
            </div>
          </div>
          <Link
            href={`/projects/${request.projectId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <FolderOpen className="h-4 w-4" />
            {request.project?.projectName ?? t("superadmin.engineeringDetail.openProject")}
          </Link>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("superadmin.engineeringDetail.status")}</label>
            <select
              value={statusEdit}
              onChange={(e) => setStatusEdit(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {ENGINEERING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`partner.engineering.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("superadmin.engineeringDetail.assignedUserId")}</label>
            <input
              value={assignedEdit}
              onChange={(e) => setAssignedEdit(e.target.value)}
              placeholder={t("superadmin.engineeringDetail.assignedPlaceholder")}
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void saveHeader()}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("common.loading") : t("superadmin.engineeringDetail.saveHeader")}
            </button>
          </div>
        </div>
        {request.notes && (
          <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t("partner.engineering.notes")}: </span>
            {request.notes}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">{t("superadmin.engineeringDetail.timeline")}</h2>
        </div>
        <ul className="divide-y divide-border">
          {events.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">{t("superadmin.engineeringDetail.noEvents")}</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(ev.createdAt).toLocaleString()}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                    {ev.visibility === "internal" ? t("superadmin.engineeringDetail.visInternal") : t("superadmin.engineeringDetail.visPartner")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{ev.body}</p>
                {(ev.fromStatus || ev.toStatus) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ev.fromStatus && `${t("superadmin.engineeringDetail.from")}: ${t(`partner.engineering.status.${ev.fromStatus}`)}`}
                    {ev.fromStatus && ev.toStatus ? " → " : ""}
                    {ev.toStatus && `${t("superadmin.engineeringDetail.to")}: ${t(`partner.engineering.status.${ev.toStatus}`)}`}
                  </p>
                )}
                {ev.authorUser?.fullName && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("superadmin.engineeringDetail.by")} {ev.authorUser.fullName}
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">{t("superadmin.engineeringDetail.addNote")}</h2>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={4}
          className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("superadmin.engineeringDetail.notePlaceholder")}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={noteVisibility}
            onChange={(e) => setNoteVisibility(e.target.value as "partner" | "internal")}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="partner">{t("superadmin.engineeringDetail.visPartner")}</option>
            <option value="internal">{t("superadmin.engineeringDetail.visInternal")}</option>
          </select>
          <select
            value={noteToStatus}
            onChange={(e) => setNoteToStatus(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("superadmin.engineeringDetail.keepStatus")}</option>
            {ENGINEERING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`partner.engineering.status.${s}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void postNote()}
            disabled={postingNote || !noteBody.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {postingNote ? t("common.loading") : t("superadmin.engineeringDetail.publishNote")}
          </button>
        </div>
      </div>
    </div>
  );
}

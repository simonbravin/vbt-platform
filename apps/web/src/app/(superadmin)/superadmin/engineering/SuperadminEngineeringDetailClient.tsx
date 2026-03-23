"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FolderOpen, Wrench, FileText, ExternalLink, Upload } from "lucide-react";
import { parseEngineeringTimelineEvent } from "@vbt/core";
import { useT } from "@/lib/i18n/context";
import { renderEngineeringTimelineBody } from "@/lib/engineering-timeline-ui";

const ENGINEERING_STATUSES = ["draft", "in_review", "completed"] as const;

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
  files?: { id: string; fileName: string; fileUrl?: string | null }[];
  deliverables?: {
    id: string;
    title?: string | null;
    fileName?: string | null;
    fileUrl?: string | null;
    version?: number;
    createdAt?: string;
  }[];
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
  const [revTitle, setRevTitle] = useState("");
  const [revUploading, setRevUploading] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);
  const revFileRef = useRef<HTMLInputElement>(null);
  const [platformUsers, setPlatformUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);

  useEffect(() => {
    fetch("/api/saas/platform-users")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Array.isArray(d?.users) && setPlatformUsers(d.users))
      .catch(() => {});
  }, []);

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
      setRequest(data);
      setStatusEdit(data.status ?? "");
      setAssignedEdit(data.assignedToUser?.id ?? "");
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  const uploadRevision = async () => {
    const file = revFileRef.current?.files?.[0];
    if (!file) {
      setRevError(t("superadmin.engineeringDetail.pickRevisionFile"));
      return;
    }
    setRevError(null);
    setRevUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`/api/saas/engineering/${requestId}/upload`, { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        const upMsg =
          typeof upData?.message === "string"
            ? upData.message
            : typeof upData?.error === "string"
              ? upData.error
              : null;
        setRevError(upMsg?.trim() ? upMsg : t("superadmin.engineeringDetail.revisionUploadFailed"));
        return;
      }
      const fileUrl = upData.url as string | undefined;
      const fileName = (upData.fileName as string | undefined) ?? file.name;
      if (!fileUrl) {
        setRevError(t("superadmin.engineeringDetail.revisionUploadFailed"));
        return;
      }
      const res = await fetch(`/api/saas/engineering/${requestId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          fileName,
          title: revTitle.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const dMsg =
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : null;
        setRevError(dMsg?.trim() ? dMsg : t("superadmin.engineeringDetail.revisionUploadFailed"));
        return;
      }
      if (data?.request) setRequest(data.request);
      else load();
      setRevTitle("");
      revFileRef.current.value = "";
    } catch {
      setRevError(t("superadmin.engineeringDetail.revisionUploadFailed"));
    } finally {
      setRevUploading(false);
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
    return <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (error && !request) {
    return <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-sm text-foreground">{error}</div>;
  }
  if (!request) return null;

  const events = request.reviewEvents ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-sm border border-alert-warningBorder bg-alert-warning px-4 py-2 text-sm text-foreground">{error}</div>
      )}

      <div className="surface-card-overflow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
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
              className="mt-1 block w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
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
            <select
              value={assignedEdit}
              onChange={(e) => setAssignedEdit(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("superadmin.engineeringDetail.assignedNone")}</option>
              {platformUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.email}
                </option>
              ))}
              {request.assignedToUser?.id &&
                !platformUsers.some((u) => u.id === request.assignedToUser?.id) && (
                  <option value={request.assignedToUser.id}>
                    {request.assignedToUser.fullName ?? request.assignedToUser.id}
                  </option>
                )}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void saveHeader()}
              disabled={saving}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

      <div className="surface-card-overflow">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">{t("superadmin.engineeringDetail.partnerFilesTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("superadmin.engineeringDetail.partnerFilesHelp")}</p>
        </div>
        {request.files && request.files.length > 0 ? (
          <ul className="divide-y divide-border p-5 space-y-0">
            {request.files.map((f) => (
              <li key={f.id} className="py-2 first:pt-0 last:pb-0">
                <a
                  href={`/api/saas/engineering/${requestId}/files/${f.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {f.fileName}
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">{t("superadmin.engineeringDetail.noPartnerFiles")}</p>
        )}
      </div>

      <div className="surface-card-overflow">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">{t("superadmin.engineeringDetail.revisionsTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("superadmin.engineeringDetail.revisionsHelp")}</p>
        </div>
        <div className="space-y-4 border-b border-border p-5">
          {revError && <p className="text-sm text-destructive">{revError}</p>}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("superadmin.engineeringDetail.revisionTitleLabel")}</label>
            <input
              value={revTitle}
              onChange={(e) => setRevTitle(e.target.value)}
              placeholder={t("superadmin.engineeringDetail.revisionTitlePlaceholder")}
              className="mt-1 block w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={revFileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.rvt,.rfa,.ifc,.zip,image/*"
              disabled={revUploading}
            />
            <button
              type="button"
              onClick={() => revFileRef.current?.click()}
              disabled={revUploading}
              className="rounded-sm border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              {t("partner.engineering.uploadFile")}
            </button>
            <button
              type="button"
              onClick={() => void uploadRevision()}
              disabled={revUploading}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {revUploading ? t("superadmin.engineeringDetail.uploadingRevision") : t("superadmin.engineeringDetail.uploadRevision")}
            </button>
          </div>
        </div>
        {request.deliverables && request.deliverables.length > 0 ? (
          <ul className="divide-y divide-border p-5">
            {request.deliverables.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <a
                    href={`/api/saas/engineering/${requestId}/deliverables/${d.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    {d.title?.trim() || d.fileName || t("partner.engineering.deliverableFallback")}
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                  </a>
                  {d.version != null && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("superadmin.engineeringDetail.versionShort", { version: d.version })}
                    </p>
                  )}
                </div>
                {d.createdAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">{t("superadmin.engineeringDetail.noRevisions")}</p>
        )}
      </div>

      <div className="surface-card-overflow">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">{t("superadmin.engineeringDetail.timeline")}</h2>
        </div>
        <ul className="divide-y divide-border">
          {events.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">{t("superadmin.engineeringDetail.noEvents")}</li>
          ) : (
            events.map((ev) => {
              const systemEntry = parseEngineeringTimelineEvent(ev.body);
              return (
                <li key={ev.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{new Date(ev.createdAt).toLocaleString()}</span>
                      {systemEntry && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                          {t("partner.engineering.timeline.systemBadge")}
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                      {ev.visibility === "internal" ? t("superadmin.engineeringDetail.visInternal") : t("superadmin.engineeringDetail.visPartner")}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">{renderEngineeringTimelineBody(ev.body, t, "admin")}</div>
                  {!systemEntry && (ev.fromStatus || ev.toStatus) && (
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
              );
            })
          )}
        </ul>
      </div>

      <div className="overflow-hidden surface-card p-5">
        <h2 className="text-base font-semibold text-foreground">{t("superadmin.engineeringDetail.addNote")}</h2>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={4}
          className="mt-3 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("superadmin.engineeringDetail.notePlaceholder")}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={noteVisibility}
            onChange={(e) => setNoteVisibility(e.target.value as "partner" | "internal")}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="partner">{t("superadmin.engineeringDetail.visPartner")}</option>
            <option value="internal">{t("superadmin.engineeringDetail.visInternal")}</option>
          </select>
          <select
            value={noteToStatus}
            onChange={(e) => setNoteToStatus(e.target.value)}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm"
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
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {postingNote ? t("common.loading") : t("superadmin.engineeringDetail.publishNote")}
          </button>
        </div>
      </div>
    </div>
  );
}

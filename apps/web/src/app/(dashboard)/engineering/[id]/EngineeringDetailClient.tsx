"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FolderOpen, FileText, ExternalLink, Upload } from "lucide-react";
import { isEngineeringStatusAllowingPartnerUpload, parseEngineeringTimelineEvent } from "@vbt/core";
import { useLanguage } from "@/lib/i18n/context";
import { renderEngineeringTimelineBody } from "@/lib/engineering-timeline-ui";

type ReviewEvent = {
  id: string;
  body: string;
  visibility: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  authorUser?: { id: string; fullName: string | null } | null;
};

type Request = {
  id: string;
  requestNumber: string;
  status: string;
  requestType?: string | null;
  wallAreaM2?: number | null;
  systemType?: string | null;
  targetDeliveryDate?: string | null;
  engineeringFeeValue?: number | null;
  notes?: string | null;
  projectId: string;
  project?: { id: string; projectName: string };
  requestedByUser?: { id: string; fullName: string | null };
  assignedToUser?: { id: string; fullName: string | null };
  files?: { id: string; fileName: string; fileUrl?: string | null }[];
  deliverables?: { id: string; title?: string | null; fileName?: string | null; fileUrl?: string | null; version?: number }[];
  reviewEvents?: ReviewEvent[];
  createdAt: string;
  updatedAt?: string;
};

interface Props {
  requestId: string;
  initialRequest?: Request | null;
}

export function EngineeringDetailClient({ requestId, initialRequest }: Props) {
  const { locale, t } = useLanguage();
  const dateLocale = locale === "es" ? "es" : "en";
  const [request, setRequest] = useState<Request | null>(initialRequest ?? null);
  const [loading, setLoading] = useState(!initialRequest);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [noteBody, setNoteBody] = useState("");
  const [resubmit, setResubmit] = useState(false);
  const [postingNote, setPostingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [attachBanner, setAttachBanner] = useState(false);

  const fetchRequest = useCallback(() => {
    fetch(`/api/saas/engineering/${requestId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRequest(data))
      .catch(() => setError(t("partner.engineering.failedToLoad")));
  }, [requestId, t]);

  useEffect(() => {
    try {
      const k = `eng-attach-warn-${requestId}`;
      if (sessionStorage.getItem(k)) {
        setAttachBanner(true);
        sessionStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }, [requestId]);

  useEffect(() => {
    if (initialRequest) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/saas/engineering/${requestId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch(() => { if (!cancelled) setError(t("partner.engineering.failedToLoad")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId, initialRequest, t]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("engineeringRequestId", requestId);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        setUploadError(uploadData?.error ?? t("partner.engineering.uploadFailed"));
        return;
      }
      const fileUrl = uploadData.url ?? uploadData.fileUrl;
      const fileName = uploadData.fileName ?? file.name;
      if (!fileUrl) {
        setUploadError(t("partner.engineering.uploadFailed"));
        return;
      }
      const filesRes = await fetch(`/api/saas/engineering/${requestId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, fileUrl, fileType: file.type || null, fileSize: file.size }),
      });
      if (!filesRes.ok) {
        const errData = await filesRes.json().catch(() => ({}));
        if (errData?.error === "partner_upload_forbidden_status") {
          setUploadError(t("partner.engineering.uploadLockedHint"));
        } else {
          const msg =
            typeof errData?.message === "string"
              ? errData.message
              : typeof errData?.error === "string"
                ? errData.error
                : null;
          setUploadError(msg && msg.length > 0 ? msg : t("partner.engineering.uploadFailed"));
        }
        return;
      }
      fetchRequest();
    } catch {
      setUploadError(t("partner.engineering.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const canSubmitForReview = request?.status === "draft";

  const canUploadFiles =
    !!request && isEngineeringStatusAllowingPartnerUpload(request.status);

  const postPartnerNote = async () => {
    if (!noteBody.trim() || !request) return;
    setNoteError(null);
    setPostingNote(true);
    try {
      const body: { body: string; visibility: "partner"; toStatus?: string } = {
        body: noteBody.trim(),
        visibility: "partner",
      };
      if (resubmit && canSubmitForReview) body.toStatus = "in_review";
      const res = await fetch(`/api/saas/engineering/${requestId}/review-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNoteError(typeof data?.error === "string" ? data.error : t("partner.engineering.noteFailed"));
        return;
      }
      setRequest(data);
      setNoteBody("");
      setResubmit(false);
    } catch {
      setNoteError(t("partner.engineering.noteFailed"));
    } finally {
      setPostingNote(false);
    }
  };

  if (loading) return <div className="surface-card p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (error || !request) return <div className="rounded-sm border border-alert-warningBorder bg-alert-warning p-6 text-foreground">{error ?? t("partner.engineering.notFound")}</div>;

  const requestTypeLabel =
    request.requestType && ["new_design", "revision", "technical_support", "other"].includes(request.requestType)
      ? t(`partner.engineering.requestType.${request.requestType}`)
      : request.requestType;
  const systemLabel = (code: string) => {
    const c = code.trim().toUpperCase();
    if (c === "S80") return t("admin.catalog.s80");
    if (c === "S150") return t("admin.catalog.s150");
    if (c === "S200") return t("admin.catalog.s200");
    return code.trim();
  };
  const systemTypeLabels = request.systemType
    ? request.systemType.split(",").map((code) => ({ code: code.trim(), label: systemLabel(code) }))
    : [];

  return (
    <div className="space-y-6">
      {attachBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-alert-warningBorder bg-alert-warning px-4 py-3 text-sm text-foreground">
          <span>{t("partner.engineering.attachmentsUploadFailed")}</span>
          <button
            type="button"
            onClick={() => setAttachBanner(false)}
            className="text-amber-800 underline font-medium"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}
      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{request.requestNumber}</h2>
            {request.updatedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("partner.engineering.lastUpdated")}:{" "}
                {new Date(request.updatedAt).toLocaleString(dateLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {t(`partner.engineering.statusHint.${request.status}`)}
            </p>
          </div>
          <span className="inline-flex shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-foreground">
            {t(`partner.engineering.status.${request.status}`)}
          </span>
        </div>
        <div className="p-5 space-y-4">
          {request.project && (
            <p className="text-sm">
              <span className="text-muted-foreground">{t("partner.engineering.project")}: </span>
              <Link href={`/projects/${request.projectId}`} className="text-primary hover:underline flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                {request.project.projectName}
              </Link>
            </p>
          )}
          {requestTypeLabel && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.requestTypeLabel")}:</span> {requestTypeLabel}
            </p>
          )}
          {request.wallAreaM2 != null && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.wallAreaM2")}:</span> {request.wallAreaM2}
            </p>
          )}
          {systemTypeLabels.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.systemType")}:</span>{" "}
              {systemTypeLabels.map((s) => (
                <span key={s.code} className="inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium bg-muted text-foreground mr-1">
                  {s.label}
                </span>
              ))}
            </p>
          )}
          {request.targetDeliveryDate && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.targetDelivery")}:</span>{" "}
              {new Date(request.targetDeliveryDate).toLocaleDateString(dateLocale)}
            </p>
          )}
          {request.requestedByUser?.fullName && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.requestedBy")}:</span> {request.requestedByUser.fullName}
            </p>
          )}
          {request.assignedToUser?.fullName && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.assignedTo")}:</span> {request.assignedToUser.fullName}
            </p>
          )}
          {request.notes && (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">{t("partner.engineering.notes")}:</span> {request.notes}
            </p>
          )}
        </div>
      </div>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-foreground">{t("partner.engineering.files")}</h3>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.rvt,.rfa,.ifc,.zip,image/*"
              onChange={onFileChange}
              disabled={uploading || !canUploadFiles}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !canUploadFiles}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border/60 bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? t("partner.engineering.uploading") : t("partner.engineering.uploadFile")}
            </button>
          </div>
        </div>
        {!canUploadFiles && (
          <p className="border-b border-border/60 px-5 py-2 text-xs text-muted-foreground">{t("partner.engineering.uploadLockedHint")}</p>
        )}
        {uploadError && <p className="px-5 py-2 text-sm text-destructive">{uploadError}</p>}
        {request.files && request.files.length > 0 ? (
          <ul className="p-5 space-y-2">
            {request.files.map((f) => (
              <li key={f.id}>
                {f.fileUrl ? (
                  <a href={f.fileUrl ? `/api/saas/engineering/${requestId}/files/${f.id}/file` : "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {f.fileName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="h-4 w-4" /> {f.fileName}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">{t("partner.engineering.noFiles")}</p>
        )}
      </div>

      {request.deliverables && request.deliverables.length > 0 && (
        <div className="surface-card-overflow">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="text-lg font-semibold text-foreground">{t("partner.engineering.deliverablesTitle")}</h3>
          </div>
          <ul className="p-5 space-y-2">
            {request.deliverables.map((d) => (
              <li key={d.id}>
                <a
                  href={`/api/saas/engineering/${requestId}/deliverables/${d.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex flex-wrap items-center gap-x-1 gap-y-0.5"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>{d.title?.trim() || d.fileName || t("partner.engineering.deliverableFallback")}</span>
                  {d.version != null && (
                    <span className="text-xs text-muted-foreground">
                      ({t("partner.engineering.deliverableVersion", { version: d.version })})
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden surface-card">
        <div className="border-b border-border/60 px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">{t("partner.engineering.timelineTitle")}</h3>
        </div>
        <ul className="divide-y divide-border/60">
          {(request.reviewEvents ?? []).length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">{t("superadmin.engineeringDetail.noEvents")}</li>
          ) : (
            (request.reviewEvents ?? []).map((ev) => {
              const systemEntry = parseEngineeringTimelineEvent(ev.body);
              return (
                <li key={ev.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(ev.createdAt).toLocaleString(dateLocale)}</span>
                    {systemEntry && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("partner.engineering.timeline.systemBadge")}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">{renderEngineeringTimelineBody(ev.body, t, "partner")}</div>
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
        <h3 className="text-lg font-semibold text-foreground">{t("partner.engineering.addPartnerNote")}</h3>
        {noteError && <p className="mt-2 text-sm text-destructive">{noteError}</p>}
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={4}
          className="input-native mt-3"
          placeholder={t("partner.engineering.notePlaceholder")}
        />
        {canSubmitForReview && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={resubmit}
              onChange={(e) => setResubmit(e.target.checked)}
              className="h-4 w-4 rounded-sm border-input"
            />
            {t("partner.engineering.resubmitLabel")}
          </label>
        )}
        <button
          type="button"
          onClick={() => void postPartnerNote()}
          disabled={postingNote || !noteBody.trim()}
          className="mt-4 rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {postingNote ? t("common.loading") : t("partner.engineering.publishNote")}
        </button>
      </div>
    </div>
  );
}

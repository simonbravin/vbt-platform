"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FolderOpen, FileText, ExternalLink, Upload } from "lucide-react";
import { useT } from "@/lib/i18n/context";

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
  deliverables?: { id: string; title?: string | null; fileUrl?: string | null }[];
  createdAt: string;
};

interface Props {
  requestId: string;
  initialRequest?: Request | null;
}

export function EngineeringDetailClient({ requestId, initialRequest }: Props) {
  const t = useT();
  const [request, setRequest] = useState<Request | null>(initialRequest ?? null);
  const [loading, setLoading] = useState(!initialRequest);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRequest = useCallback(() => {
    fetch(`/api/saas/engineering/${requestId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRequest(data))
      .catch(() => setError(t("partner.engineering.failedToLoad")));
  }, [requestId, t]);

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
        setUploadError(errData?.error ?? t("partner.engineering.uploadFailed"));
        return;
      }
      fetchRequest();
    } catch {
      setUploadError(t("partner.engineering.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t("common.loading")}</div>;
  if (error || !request) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">{error ?? t("partner.engineering.notFound")}</div>;

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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{request.requestNumber}</h2>
          <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
            {t(`partner.engineering.status.${request.status}`)}
          </span>
        </div>
        <div className="p-5 space-y-4">
          {request.project && (
            <p className="text-sm">
              <span className="text-gray-500">{t("partner.engineering.project")}: </span>
              <Link href={`/projects/${request.projectId}`} className="text-vbt-blue hover:underline flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                {request.project.projectName}
              </Link>
            </p>
          )}
          {requestTypeLabel && (
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">{t("partner.engineering.requestTypeLabel")}:</span> {requestTypeLabel}
            </p>
          )}
          {request.wallAreaM2 != null && (
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">{t("partner.engineering.wallAreaM2")}:</span> {request.wallAreaM2}
            </p>
          )}
          {systemTypeLabels.length > 0 && (
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">{t("partner.engineering.systemType")}:</span>{" "}
              {systemTypeLabels.map((s) => (
                <span key={s.code} className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 mr-1">
                  {s.label}
                </span>
              ))}
            </p>
          )}
          {request.targetDeliveryDate && <p className="text-sm text-gray-600"><span className="text-gray-500">Target delivery:</span> {new Date(request.targetDeliveryDate).toLocaleDateString()}</p>}
          {request.requestedByUser?.fullName && <p className="text-sm text-gray-600"><span className="text-gray-500">Requested by:</span> {request.requestedByUser.fullName}</p>}
          {request.assignedToUser?.fullName && <p className="text-sm text-gray-600"><span className="text-gray-500">Assigned to:</span> {request.assignedToUser.fullName}</p>}
          {request.notes && <p className="text-sm text-gray-600"><span className="text-gray-500">Notes:</span> {request.notes}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{t("partner.engineering.files")}</h3>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.rvt,.ifc,image/*"
              onChange={onFileChange}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? t("partner.engineering.uploading") : t("partner.engineering.uploadFile")}
            </button>
          </div>
        </div>
        {uploadError && <p className="px-5 py-2 text-sm text-red-600">{uploadError}</p>}
        {request.files && request.files.length > 0 ? (
          <ul className="p-5 space-y-2">
            {request.files.map((f) => (
              <li key={f.id}>
                {f.fileUrl ? (
                  <a href={f.fileUrl ? `/api/saas/engineering/${requestId}/files/${f.id}/file` : "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-vbt-blue hover:underline flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {f.fileName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-gray-600 flex items-center gap-1"><FileText className="h-4 w-4" /> {f.fileName}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-gray-500">{t("partner.engineering.noFiles")}</p>
        )}
      </div>

      {request.deliverables && request.deliverables.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Deliverables</h3>
          </div>
          <ul className="p-5 space-y-2">
            {request.deliverables.map((d) => (
              <li key={d.id}>
                {d.fileUrl ? (
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-vbt-blue hover:underline flex items-center gap-1">
                    {d.title ?? "Deliverable"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-gray-600">{d.title ?? "Deliverable"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

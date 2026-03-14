"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, FileText, ExternalLink } from "lucide-react";

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
  const [request, setRequest] = useState<Request | null>(initialRequest ?? null);
  const [loading, setLoading] = useState(!initialRequest);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRequest) return;
    let cancelled = false;
    fetch(`/api/saas/engineering/${requestId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch(() => { if (!cancelled) setError("Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId, initialRequest]);

  if (loading) return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading...</div>;
  if (error || !request) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">{error ?? "Not found"}</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{request.requestNumber}</h2>
          <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{request.status}</span>
        </div>
        <div className="p-5 space-y-4">
          {request.project && (
            <p className="text-sm">
              <span className="text-gray-500">Project: </span>
              <Link href={`/projects/${request.projectId}`} className="text-vbt-blue hover:underline flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                {request.project.projectName}
              </Link>
            </p>
          )}
          {request.requestType && <p className="text-sm text-gray-600"><span className="text-gray-500">Type:</span> {request.requestType}</p>}
          {request.wallAreaM2 != null && <p className="text-sm text-gray-600"><span className="text-gray-500">Wall area (m²):</span> {request.wallAreaM2}</p>}
          {request.systemType && <p className="text-sm text-gray-600"><span className="text-gray-500">System:</span> {request.systemType}</p>}
          {request.targetDeliveryDate && <p className="text-sm text-gray-600"><span className="text-gray-500">Target delivery:</span> {new Date(request.targetDeliveryDate).toLocaleDateString()}</p>}
          {request.requestedByUser?.fullName && <p className="text-sm text-gray-600"><span className="text-gray-500">Requested by:</span> {request.requestedByUser.fullName}</p>}
          {request.assignedToUser?.fullName && <p className="text-sm text-gray-600"><span className="text-gray-500">Assigned to:</span> {request.assignedToUser.fullName}</p>}
          {request.notes && <p className="text-sm text-gray-600"><span className="text-gray-500">Notes:</span> {request.notes}</p>}
        </div>
      </div>

      {request.files && request.files.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Files</h3>
          </div>
          <ul className="p-5 space-y-2">
            {request.files.map((f) => (
              <li key={f.id}>
                {f.fileUrl ? (
                  <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-vbt-blue hover:underline flex items-center gap-1">
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
        </div>
      )}

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

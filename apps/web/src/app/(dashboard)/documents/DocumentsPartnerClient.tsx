"use client";

import { useEffect, useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  visibility: string;
  category?: { name: string; code: string };
};

export function DocumentsPartnerClient() {
  const t = useT();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saas/documents?limit=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setDocuments(data.documents ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => { if (!cancelled) setError(t("partner.documents.failedToLoad")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  if (loading) return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">{error}</div>;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {documents.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-900">{t("partner.documents.noDocuments")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <li key={doc.id} className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50">
              <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gray-900 hover:text-vbt-blue flex items-center gap-1"
                >
                  {doc.title}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {doc.description && <p className="text-sm text-gray-500 mt-0.5">{doc.description}</p>}
                {doc.category && <p className="text-xs text-gray-400 mt-1">{doc.category.name}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {documents.length > 0 && <p className="px-5 py-2 text-xs text-gray-500 border-t border-gray-100">{total} document(s)</p>}
    </div>
  );
}

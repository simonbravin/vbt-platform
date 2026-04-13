"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

type Project = { id: string; projectName: string; projectCode?: string | null };

function CreateQuotePage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams.get("projectId");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectIdFromQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectIdFromQuery) setProjectId(projectIdFromQuery);
  }, [projectIdFromQuery]);

  useEffect(() => {
    fetch("/api/saas/projects?limit=200")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  async function handleCreate() {
    if (!projectId.trim()) {
      setError(t("quotes.selectProjectError"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/saas/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("quotes.failedCreate"));
        return;
      }
      router.push(`/quotes/${data.id}`);
    } catch {
      setError(t("quotes.failedCreate"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="data-entry-page">
      <div className="flex items-center gap-3">
        <Link
          href={projectIdFromQuery ? `/projects/${projectIdFromQuery}` : "/quotes"}
          className="p-2 rounded-lg border border-border/60 hover:bg-muted/40"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("quotes.newQuoteTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("quotes.createDraftSubtitle")}</p>
        </div>
      </div>

      <div className="surface-card space-y-4 p-5">
        <label className="block text-sm font-medium text-foreground">{t("quotes.selectProject")}</label>
        <FilterSelect
          value={projectId}
          onValueChange={setProjectId}
          emptyOptionLabel={t("quotes.selectProjectPlaceholder")}
          options={projects.map((p) => ({
            value: p.id,
            label: p.projectName || p.projectCode || p.id.slice(0, 8),
          }))}
          aria-label={t("quotes.selectProject")}
          triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
          disabled={!!projectIdFromQuery}
        />
        {projectIdFromQuery && (
          <p className="text-xs text-muted-foreground">{t("quotes.projectFixedFromLink")}</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !projectId.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-5 py-3 text-[17px] font-normal text-primary-foreground hover:opacity-[0.88] disabled:pointer-events-none disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          {loading ? t("quotes.creating") : t("quotes.createDraftButton")}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("quotes.createDraftHint")}
      </p>
    </div>
  );
}

function CreateQuoteFallback() {
  const t = useT();
  return <div className="data-entry-page p-6">{t("common.loading")}</div>;
}

export default function CreateQuotePageWithSuspense() {
  return (
    <Suspense fallback={<CreateQuoteFallback />}>
      <CreateQuotePage />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

type Project = { id: string; projectName: string; projectCode?: string | null };

function CreateQuotePage() {
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
    fetch("/api/projects?limit=200")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  async function handleCreate() {
    if (!projectId.trim()) {
      setError("Select a project");
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
        setError(data.error ?? "Failed to create quote");
        return;
      }
      router.push(`/quotes/${data.id}`);
    } catch {
      setError("Failed to create quote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={projectIdFromQuery ? `/projects/${projectIdFromQuery}` : "/quotes"}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New Quote</h1>
          <p className="text-sm text-gray-500">Create a draft quote for a project</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <label className="block text-sm font-medium text-gray-700">Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vbt-blue focus:border-vbt-blue"
          disabled={!!projectIdFromQuery}
        >
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectName || p.projectCode || p.id.slice(0, 8)}
            </option>
          ))}
        </select>
        {projectIdFromQuery && (
          <p className="text-xs text-gray-500">Project is fixed from the link.</p>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !projectId.trim()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-vbt-orange text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:pointer-events-none"
        >
          <FileText className="w-4 h-4" />
          {loading ? "Creating..." : "Create draft quote"}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        The quote will be created with status <strong>draft</strong> and version 1. You can add
        items and pricing on the quote detail page.
      </p>
    </div>
  );
}

export default function CreateQuotePageWithSuspense() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto p-6">Loading...</div>}>
      <CreateQuotePage />
    </Suspense>
  );
}

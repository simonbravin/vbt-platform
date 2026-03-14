"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ProjectOption = { id: string; projectName: string };

export function NewEngineeringRequestForm() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({
    projectId: "",
    requestNumber: "",
    requestType: "",
    wallAreaM2: "",
    systemType: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saas/projects?limit=100")
      .then((r) => r.ok ? r.json() : { projects: [] })
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.projectId || !form.requestNumber.trim()) {
      setError("Project and request number are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/saas/engineering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.projectId,
          requestNumber: form.requestNumber.trim(),
          status: "draft",
          requestType: form.requestType.trim() || undefined,
          wallAreaM2: form.wallAreaM2 ? Number(form.wallAreaM2) : undefined,
          systemType: form.systemType.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? "Failed to create request");
        return;
      }
      const created = await res.json();
      router.push(`/engineering/${created.id}`);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Request number *</label>
          <input
            type="text"
            value={form.requestNumber}
            onChange={(e) => setForm((f) => ({ ...f, requestNumber: e.target.value }))}
            required
            placeholder="e.g. ER-2024-001"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Request type</label>
          <input
            type="text"
            value={form.requestType}
            onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wall area (m²)</label>
          <input
            type="number"
            step="any"
            value={form.wallAreaM2}
            onChange={(e) => setForm((f) => ({ ...f, wallAreaM2: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">System type</label>
          <input
            type="text"
            value={form.systemType}
            onChange={(e) => setForm((f) => ({ ...f, systemType: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-vbt-blue px-4 py-2 text-sm font-medium text-white hover:bg-vbt-blue/90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create request"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/engineering")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

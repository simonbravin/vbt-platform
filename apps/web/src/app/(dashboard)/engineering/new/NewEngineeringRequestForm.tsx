"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

type ProjectOption = { id: string; projectName: string };

const REQUEST_TYPE_OPTIONS = [
  { value: "new_design", labelKey: "partner.engineering.requestType.new_design" },
  { value: "revision", labelKey: "partner.engineering.requestType.revision" },
  { value: "technical_support", labelKey: "partner.engineering.requestType.technical_support" },
  { value: "other", labelKey: "partner.engineering.requestType.other" },
] as const;

const SYSTEM_OPTIONS = [
  { value: "S80", labelKey: "admin.catalog.s80" },
  { value: "S150", labelKey: "admin.catalog.s150" },
  { value: "S200", labelKey: "admin.catalog.s200" },
] as const;

export function NewEngineeringRequestForm() {
  const t = useT();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({
    projectId: "",
    requestNumber: "",
    requestType: "",
    wallAreaM2: "",
    systemTypeIds: [] as string[],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/saas/projects?limit=100")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.projectId || !form.requestNumber.trim()) {
      setError(t("partner.engineering.validationProjectAndNumber"));
      return;
    }
    setSaving(true);
    try {
      const systemType = form.systemTypeIds.length > 0 ? form.systemTypeIds.join(",") : undefined;
      const res = await fetch("/api/saas/engineering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.projectId,
          requestNumber: form.requestNumber.trim(),
          status: "draft",
          requestType: form.requestType.trim() || undefined,
          wallAreaM2: form.wallAreaM2 ? Number(form.wallAreaM2) : undefined,
          systemType,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(typeof err?.error === "string" ? err.error : t("partner.engineering.createFailed"));
        return;
      }
      const created = await res.json();
      const newId = created.id as string;
      let uploadFailed = false;
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("engineeringRequestId", newId);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json().catch(() => ({}));
        const fileUrl = uploadData.url ?? uploadData.fileUrl;
        const fileName = uploadData.fileName ?? file.name;
        if (!uploadRes.ok || !fileUrl) {
          uploadFailed = true;
          continue;
        }
        const filesRes = await fetch(`/api/saas/engineering/${newId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            fileUrl,
            fileType: file.type || null,
            fileSize: file.size,
          }),
        });
        if (!filesRes.ok) uploadFailed = true;
      }
      if (uploadFailed) {
        try {
          sessionStorage.setItem(`eng-attach-warn-${newId}`, "1");
        } catch {
          /* ignore */
        }
      }
      router.push(`/engineering/${newId}`);
      router.refresh();
    } catch {
      setError(t("partner.engineering.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleSystem = (value: string) => {
    setForm((f) =>
      f.systemTypeIds.includes(value)
        ? { ...f, systemTypeIds: f.systemTypeIds.filter((x) => x !== value) }
        : { ...f, systemTypeIds: [...f.systemTypeIds, value] }
    );
  };

  return (
    <div className="surface-card p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.project")} *</label>
          <FilterSelect
            value={form.projectId}
            onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
            emptyOptionLabel={t("partner.engineering.selectProject")}
            options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
            aria-label={t("partner.engineering.project")}
            triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.request")} # *</label>
          <input
            type="text"
            value={form.requestNumber}
            onChange={(e) => setForm((f) => ({ ...f, requestNumber: e.target.value }))}
            required
            placeholder={t("partner.engineering.requestNumberPlaceholder")}
            className="input-native"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.requestTypeLabel")}</label>
          <FilterSelect
            value={form.requestType}
            onValueChange={(v) => setForm((f) => ({ ...f, requestType: v }))}
            emptyOptionLabel="—"
            options={REQUEST_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.labelKey),
            }))}
            aria-label={t("partner.engineering.requestTypeLabel")}
            triggerClassName="h-10 w-full min-w-0 max-w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.wallAreaM2")}</label>
          <input
            type="number"
            step="any"
            value={form.wallAreaM2}
            onChange={(e) => setForm((f) => ({ ...f, wallAreaM2: e.target.value }))}
            className="input-native"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.systemType")}</label>
          <div className="flex flex-wrap gap-4">
            {SYSTEM_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.systemTypeIds.includes(opt.value)}
                  onChange={() => toggleSystem(opt.value)}
                  className="rounded-lg border-input"
                />
                <span className="text-sm text-foreground">{t(opt.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.notes")}</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="input-native min-h-[5.5rem] resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("partner.engineering.attachmentsOnCreate")}</label>
          <p className="text-xs text-muted-foreground mb-2">{t("partner.engineering.attachmentsHint")}</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.rvt,.rfa,.ifc,.zip,image/*"
            onChange={(e) => {
              const list = e.target.files;
              setPendingFiles(list ? Array.from(list) : []);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("partner.engineering.uploadFile")}
          </button>
          {pendingFiles.length > 0 && (
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-0.5">
              {pendingFiles.map((f, i) => (
                <li key={`${i}-${f.name}-${f.size}-${f.lastModified}`}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("partner.engineering.creating") : t("partner.engineering.createRequest")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/engineering")}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}

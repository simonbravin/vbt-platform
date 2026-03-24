"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createQuizDefinitionSchema, updateQuizDefinitionSchema } from "@vbt/core/validation";
import { useT } from "@/lib/i18n/context";
import { useToast } from "@/components/ui/use-toast";

type Topic = { id: string; name: string };
type Partner = { id: string; name: string };

type TopicRuleRow = { topicId: string; pickCount: number };

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type DefApi = {
  id: string;
  title: string;
  description: string | null;
  passingScorePct: number;
  status: string;
  publishedAt: string | null;
  visibility: string;
  topicRules: { topicId: string; pickCount: number }[];
  allowedOrganizations?: { organizationId: string }[];
};

export function QuizDefinitionFormClient({ definitionId }: { definitionId?: string }) {
  const t = useT();
  const { toast } = useToast();
  const router = useRouter();
  const isEdit = !!definitionId;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(isEdit);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScorePct, setPassingScorePct] = useState(70);
  const [visibility, setVisibility] = useState<"all_partners" | "selected_partners">("all_partners");
  const [allowedOrganizationIds, setAllowedOrganizationIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [publishedAtLocal, setPublishedAtLocal] = useState("");
  const [topicRules, setTopicRules] = useState<TopicRuleRow[]>([{ topicId: "", pickCount: 1 }]);

  const loadRefs = useCallback(async () => {
    const [tRes, pRes] = await Promise.all([
      fetch("/api/saas/quizzes/topics"),
      fetch("/api/saas/partners?limit=300"),
    ]);
    const tJson = tRes.ok ? await tRes.json() : [];
    const pJson = pRes.ok ? await pRes.json() : { partners: [] };
    setTopics(Array.isArray(tJson) ? tJson : []);
    setPartners(Array.isArray(pJson.partners) ? pJson.partners : []);
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    if (!definitionId) return;
    let c = false;
    (async () => {
      const r = await fetch(`/api/saas/quizzes/definitions/${definitionId}`);
      if (!r.ok || c) {
        if (!c) setLoading(false);
        return;
      }
      const d = (await r.json()) as DefApi;
      if (c) return;
      setTitle(d.title);
      setDescription(d.description ?? "");
      setPassingScorePct(d.passingScorePct);
      setVisibility(d.visibility === "selected_partners" ? "selected_partners" : "all_partners");
      setAllowedOrganizationIds((d.allowedOrganizations ?? []).map((x) => x.organizationId));
      setStatus(d.status as "draft" | "published" | "archived");
      setPublishedAtLocal(d.publishedAt ? toDatetimeLocal(new Date(d.publishedAt)) : "");
      setTopicRules(
        d.topicRules?.length
          ? d.topicRules.map((r) => ({ topicId: r.topicId, pickCount: r.pickCount }))
          : [{ topicId: "", pickCount: 1 }]
      );
      setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [definitionId]);

  function toggleOrg(id: string) {
    setAllowedOrganizationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buildPayload(): Record<string, unknown> {
    const allowed =
      visibility === "selected_partners" ? allowedOrganizationIds : [];

    const rules = topicRules
      .filter((r) => r.topicId)
      .map((r) => ({
        topicId: r.topicId,
        pickCount: Math.max(1, Math.floor(Number(r.pickCount)) || 1),
      }));

    const base: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      passingScorePct: Number(passingScorePct),
      visibility,
      status,
      topicRules: rules,
      allowedOrganizationIds: allowed,
    };

    if (status === "published") {
      base.publishedAt = publishedAtLocal
        ? new Date(publishedAtLocal).toISOString()
        : new Date().toISOString();
    } else if (status === "draft") {
      base.publishedAt = null;
    } else if (publishedAtLocal) {
      base.publishedAt = new Date(publishedAtLocal).toISOString();
    }

    return base;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();

    if (isEdit) {
      const parsed = updateQuizDefinitionSchema.safeParse(payload);
      if (!parsed.success) {
        toast({
          title: t("superadmin.quizzes.definitions.validationError"),
          description: parsed.error.issues[0]?.message,
          variant: "destructive",
        });
        return;
      }
      const r = await fetch(`/api/saas/quizzes/definitions/${definitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast({
          title: t("superadmin.quizzes.definitions.saveError"),
          description: typeof j.error === "string" ? j.error : undefined,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t("superadmin.quizzes.definitions.updated") });
      router.push("/superadmin/quizzes/definitions");
      return;
    }

    const parsed = createQuizDefinitionSchema.safeParse(payload);
    if (!parsed.success) {
      toast({
        title: t("superadmin.quizzes.definitions.validationError"),
        description: parsed.error.issues[0]?.message,
        variant: "destructive",
      });
      return;
    }
    const r = await fetch("/api/saas/quizzes/definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({
        title: t("superadmin.quizzes.definitions.saveError"),
        description: typeof j.error === "string" ? j.error : undefined,
        variant: "destructive",
      });
      return;
    }
    toast({ title: t("superadmin.quizzes.definitions.created") });
    router.push("/superadmin/quizzes/definitions");
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/superadmin/quizzes/definitions"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← {t("superadmin.quizzes.definitions.back")}
      </Link>

      <form onSubmit={(e) => void handleSubmit(e)} className="surface-card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isEdit ? t("superadmin.quizzes.definitions.editTitle") : t("superadmin.quizzes.definitions.newTitle")}
        </h2>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.colTitle")}
          </label>
          <input className="input-native w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.definitions.description")}
          </label>
          <textarea
            className="input-native w-full min-h-[72px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.colPassing")}
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className="input-native w-full max-w-xs"
            value={passingScorePct}
            onChange={(e) => setPassingScorePct(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.definitions.visibility")}
          </label>
          <select
            className="input-native w-full max-w-md"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="all_partners">{t("superadmin.quizzes.visibility.all_partners")}</option>
            <option value="selected_partners">{t("superadmin.quizzes.visibility.selected_partners")}</option>
          </select>
        </div>

        {visibility === "selected_partners" && (
          <div className="border border-border/60 rounded-sm p-3 max-h-48 overflow-y-auto space-y-2">
            <p className="text-xs text-muted-foreground">{t("superadmin.quizzes.definitions.pickPartners")}</p>
            {partners.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("superadmin.quizzes.definitions.noPartners")}</p>
            ) : (
              partners.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedOrganizationIds.includes(p.id)}
                    onChange={() => toggleOrg(p.id)}
                    className="h-4 w-4 accent-primary rounded-sm"
                  />
                  <span>{p.name}</span>
                </label>
              ))
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.definitions.topicRules")}
          </label>
          <div className="space-y-2">
            {topicRules.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <select
                  className="input-native flex-1 min-w-[10rem]"
                  value={row.topicId}
                  onChange={(e) =>
                    setTopicRules((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, topicId: e.target.value } : r))
                    )
                  }
                >
                  <option value="">{t("superadmin.quizzes.definitions.pickTopic")}</option>
                  {topics.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="input-native w-24"
                  value={row.pickCount}
                  onChange={(e) =>
                    setTopicRules((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, pickCount: Number(e.target.value) } : r))
                    )
                  }
                />
                {topicRules.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground"
                    onClick={() => setTopicRules((prev) => prev.filter((_, j) => j !== i))}
                  >
                    {t("superadmin.quizzes.questions.removeOption")}
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-primary font-medium"
              onClick={() => setTopicRules((prev) => [...prev, { topicId: "", pickCount: 1 }])}
            >
              {t("superadmin.quizzes.definitions.addRule")}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.colStatus")}
          </label>
          <select
            className="input-native w-full max-w-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="draft">{t("superadmin.quizzes.status.draft")}</option>
            <option value="published">{t("superadmin.quizzes.status.published")}</option>
            <option value="archived">{t("superadmin.quizzes.status.archived")}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("superadmin.quizzes.definitions.publishedAt")}
          </label>
          <input
            type="datetime-local"
            className="input-native w-full max-w-xs"
            value={publishedAtLocal}
            onChange={(e) => setPublishedAtLocal(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">{t("superadmin.quizzes.definitions.publishedAtHint")}</p>
        </div>

        <button
          type="submit"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("common.save")}
        </button>
      </form>
    </div>
  );
}

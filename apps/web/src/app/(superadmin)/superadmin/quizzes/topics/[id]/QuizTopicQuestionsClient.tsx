"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { useToast } from "@/components/ui/use-toast";

type Option = { id?: string; label: string; isCorrect: boolean; sortOrder?: number };

type Question = {
  id: string;
  stem: string;
  status: string;
  options: Option[];
};

function emptyOptions(n: number): Option[] {
  return Array.from({ length: n }, (_, i) => ({
    label: "",
    isCorrect: i === 0,
    sortOrder: i,
  }));
}

function questionStatusLabel(t: (key: string) => string, status: string) {
  const key = `superadmin.quizzes.status.${status}`;
  const out = t(key);
  return out === key ? status : out;
}

export function QuizTopicQuestionsClient({ topicId }: { topicId: string }) {
  const t = useT();
  const { toast } = useToast();
  const [topicName, setTopicName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [newStem, setNewStem] = useState("");
  const [newStatus, setNewStatus] = useState<"draft" | "published">("draft");
  const [newOptions, setNewOptions] = useState<Option[]>(() => emptyOptions(2));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStem, setEditStem] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "published">("draft");
  const [editOptions, setEditOptions] = useState<Option[]>([]);

  const load = useCallback(async () => {
    const [tq, qq] = await Promise.all([
      fetch("/api/saas/quizzes/topics").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/saas/quizzes/topics/${topicId}/questions`).then((r) => (r.ok ? r.json() : [])),
    ]);
    const topics = Array.isArray(tq) ? tq : [];
    const found = topics.find((x: { id: string }) => x.id === topicId);
    setTopicName(found?.name ?? topicId);
    setQuestions(Array.isArray(qq) ? qq : []);
  }, [topicId]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  function setCorrectExclusive(opts: Option[], index: number): Option[] {
    return opts.map((o, i) => ({ ...o, isCorrect: i === index }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newStem.trim()) return;
    const correct = newOptions.filter((o) => o.isCorrect);
    if (correct.length !== 1) {
      toast({
        title: t("superadmin.quizzes.questions.oneCorrectError"),
        variant: "destructive",
      });
      return;
    }
    const options = newOptions
      .map((o, i) => ({ label: o.label.trim(), isCorrect: o.isCorrect, sortOrder: i }))
      .filter((o) => o.label.length > 0);
    if (options.length < 2) {
      toast({
        title: t("superadmin.quizzes.questions.minOptionsError"),
        variant: "destructive",
      });
      return;
    }
    const r = await fetch(`/api/saas/quizzes/topics/${topicId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: newStem.trim(),
        status: newStatus,
        options,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({
        title: t("superadmin.quizzes.questions.saveError"),
        description: typeof j.error === "string" ? j.error : undefined,
        variant: "destructive",
      });
      return;
    }
    setNewStem("");
    setNewStatus("draft");
    setNewOptions(emptyOptions(2));
    await load();
    toast({ title: t("superadmin.quizzes.questions.created") });
  }

  async function handleSaveEdit() {
    if (!editingId || !editStem.trim()) return;
    const correct = editOptions.filter((o) => o.isCorrect);
    if (correct.length !== 1) {
      toast({
        title: t("superadmin.quizzes.questions.oneCorrectError"),
        variant: "destructive",
      });
      return;
    }
    const options = editOptions
      .map((o, i) => ({ label: o.label.trim(), isCorrect: o.isCorrect, sortOrder: i }))
      .filter((o) => o.label.length > 0);
    if (options.length < 2) {
      toast({
        title: t("superadmin.quizzes.questions.minOptionsError"),
        variant: "destructive",
      });
      return;
    }
    const r = await fetch(`/api/saas/quizzes/questions/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: editStem.trim(),
        status: editStatus,
        options,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({
        title: t("superadmin.quizzes.questions.saveError"),
        description: typeof j.error === "string" ? j.error : undefined,
        variant: "destructive",
      });
      return;
    }
    setEditingId(null);
    await load();
    toast({ title: t("superadmin.quizzes.questions.updated") });
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setEditStem(q.stem);
    setEditStatus(q.status === "published" ? "published" : "draft");
    const sorted = [...q.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    setEditOptions(
      sorted.length >= 2
        ? sorted.map((o, i) => ({
            label: o.label,
            isCorrect: o.isCorrect,
            sortOrder: i,
          }))
        : emptyOptions(2)
    );
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  function renderOptionEditors(
    opts: Option[],
    setOpts: React.Dispatch<React.SetStateAction<Option[]>>,
    prefix: string
  ) {
    return (
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={`${prefix}-${i}`} className="flex flex-wrap items-center gap-2">
            <input
              type="radio"
              name={`${prefix}-correct`}
              checked={o.isCorrect}
              onChange={() => setOpts((prev) => setCorrectExclusive(prev, i))}
              className="h-4 w-4 accent-primary"
              aria-label={t("superadmin.quizzes.questions.correctOption")}
            />
            <input
              className="input-native flex-1 min-w-[12rem]"
              placeholder={t("superadmin.quizzes.questions.optionPlaceholder", { n: String(i + 1) })}
              value={o.label}
              onChange={(e) =>
                setOpts((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
              }
            />
            {opts.length > 2 && (
              <button
                type="button"
                className="text-xs text-muted-foreground"
                onClick={() => setOpts((prev) => prev.filter((_, j) => j !== i))}
              >
                {t("superadmin.quizzes.questions.removeOption")}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-primary font-medium"
          onClick={() => setOpts((prev) => [...prev, { label: "", isCorrect: false, sortOrder: prev.length }])}
        >
          {t("superadmin.quizzes.questions.addOption")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/superadmin/quizzes/topics"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← {t("superadmin.quizzes.topics.backToTopics")}
      </Link>
      <h2 className="text-xl font-semibold text-foreground">{topicName}</h2>

      <form onSubmit={handleCreate} className="surface-card p-4 space-y-3">
        <h3 className="font-medium text-foreground">{t("superadmin.quizzes.questions.newHeading")}</h3>
        <textarea
          className="input-native w-full min-h-[80px]"
          placeholder={t("superadmin.quizzes.questions.stemPlaceholder")}
          value={newStem}
          onChange={(e) => setNewStem(e.target.value)}
        />
        <select
          className="input-native w-full max-w-xs"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value as "draft" | "published")}
        >
          <option value="draft">{t("superadmin.quizzes.status.draft")}</option>
          <option value="published">{t("superadmin.quizzes.status.published")}</option>
        </select>
        {renderOptionEditors(newOptions, setNewOptions, "new")}
        <button
          type="submit"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("superadmin.quizzes.questions.create")}
        </button>
      </form>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-lg font-semibold">{t("superadmin.quizzes.questions.listHeading")}</h3>
        </div>
        {questions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("superadmin.quizzes.questions.empty")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {questions.map((q) => (
              <li key={q.id} className="px-5 py-4 space-y-3">
                {editingId === q.id ? (
                  <div className="space-y-3 max-w-3xl">
                    <textarea
                      className="input-native w-full min-h-[80px]"
                      value={editStem}
                      onChange={(e) => setEditStem(e.target.value)}
                    />
                    <select
                      className="input-native w-full max-w-xs"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as "draft" | "published")}
                    >
                      <option value="draft">{t("superadmin.quizzes.status.draft")}</option>
                      <option value="published">{t("superadmin.quizzes.status.published")}</option>
                    </select>
                    {renderOptionEditors(editOptions, setEditOptions, `edit-${q.id}`)}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary"
                        onClick={() => void handleSaveEdit()}
                      >
                        {t("common.save")}
                      </button>
                      <button type="button" className="text-sm text-muted-foreground" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{q.stem}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("superadmin.quizzes.colStatus")}: {questionStatusLabel(t, q.status)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary self-start"
                      onClick={() => startEdit(q)}
                    >
                      {t("common.edit")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

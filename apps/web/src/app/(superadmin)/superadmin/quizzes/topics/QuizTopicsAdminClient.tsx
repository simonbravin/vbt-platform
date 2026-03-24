"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { useToast } from "@/components/ui/use-toast";

type Topic = { id: string; name: string; code: string | null; sortOrder: number };

export function QuizTopicsAdminClient() {
  const t = useT();
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/saas/quizzes/topics");
    if (!r.ok) {
      setTopics([]);
      return;
    }
    const data = await r.json();
    setTopics(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await fetch("/api/saas/quizzes/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        code: code.trim() || null,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({
        title: t("superadmin.quizzes.topics.saveError"),
        description: typeof j.error === "string" ? j.error : undefined,
        variant: "destructive",
      });
      return;
    }
    setName("");
    setCode("");
    await load();
    toast({ title: t("superadmin.quizzes.topics.created") });
  }

  async function saveEdit(id: string) {
    const r = await fetch(`/api/saas/quizzes/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        code: editCode.trim() || null,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({
        title: t("superadmin.quizzes.topics.saveError"),
        description: typeof j.error === "string" ? j.error : undefined,
        variant: "destructive",
      });
      return;
    }
    setEditingId(null);
    await load();
    toast({ title: t("superadmin.quizzes.topics.updated") });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/superadmin/quizzes"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← {t("superadmin.quizzes.hub.back")}
      </Link>

      <form onSubmit={handleCreate} className="surface-card p-4 space-y-3 max-w-lg">
        <h2 className="font-medium text-foreground">{t("superadmin.quizzes.topics.createHeading")}</h2>
        <input
          className="input-native w-full"
          placeholder={t("superadmin.quizzes.topics.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input-native w-full"
          placeholder={t("superadmin.quizzes.topics.codePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("superadmin.quizzes.topics.create")}
        </button>
      </form>

      <div className="surface-card-overflow">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold text-foreground">{t("superadmin.quizzes.topics.listHeading")}</h2>
        </div>
        {topics.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("superadmin.quizzes.topics.empty")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {topics.map((topic) => (
              <li key={topic.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {editingId === topic.id ? (
                  <div className="flex flex-col gap-2 flex-1 max-w-xl">
                    <input
                      className="input-native w-full"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      className="input-native w-full"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      placeholder={t("superadmin.quizzes.topics.codePlaceholder")}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary"
                        onClick={() => void saveEdit(topic.id)}
                      >
                        {t("common.save")}
                      </button>
                      <button
                        type="button"
                        className="text-sm text-muted-foreground"
                        onClick={() => setEditingId(null)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-foreground">{topic.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {topic.code ? `${t("superadmin.quizzes.topics.codeLabel")}: ${topic.code}` : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/superadmin/quizzes/topics/${topic.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t("superadmin.quizzes.topics.manageQuestions")}
                      </Link>
                      <button
                        type="button"
                        className="text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(topic.id);
                          setEditName(topic.name);
                          setEditCode(topic.code ?? "");
                        }}
                      >
                        {t("common.edit")}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

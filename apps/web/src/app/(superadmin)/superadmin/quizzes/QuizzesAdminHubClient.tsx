"use client";

import Link from "next/link";
import { Award, BookOpen, Layers, ListChecks } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const cardClass =
  "surface-card p-5 flex flex-col gap-2 hover:border-primary/30 transition-colors border border-border/60";

export function QuizzesAdminHubClient() {
  const t = useT();

  const items = [
    {
      href: "/superadmin/quizzes/topics",
      icon: Layers,
      titleKey: "superadmin.quizzes.hub.topicsTitle",
      descKey: "superadmin.quizzes.hub.topicsDesc",
    },
    {
      href: "/superadmin/quizzes/definitions",
      icon: BookOpen,
      titleKey: "superadmin.quizzes.hub.definitionsTitle",
      descKey: "superadmin.quizzes.hub.definitionsDesc",
    },
    {
      href: "/superadmin/quizzes/attempts",
      icon: ListChecks,
      titleKey: "superadmin.quizzes.hub.attemptsTitle",
      descKey: "superadmin.quizzes.hub.attemptsDesc",
    },
    {
      href: "/superadmin/training/certificates",
      icon: Award,
      titleKey: "superadmin.quizzes.hub.certificatesTitle",
      descKey: "superadmin.quizzes.hub.certificatesDesc",
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ href, icon: Icon, titleKey, descKey }) => (
        <Link key={href} href={href} className={cardClass}>
          <div className="flex items-center gap-2 text-foreground">
            <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <span className="font-semibold">{t(titleKey)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t(descKey)}</p>
        </Link>
      ))}
    </div>
  );
}

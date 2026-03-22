import { requireAuth } from "@/lib/utils";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { ProjectLogsClient } from "./ProjectLogsClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function ProjectLogsPage() {
  await requireAuth();
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="text-muted-foreground/70 hover:text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("projects.projectActivity")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("projects.projectActivitySub")}</p>
        </div>
      </div>
      <ProjectLogsClient />
    </div>
  );
}

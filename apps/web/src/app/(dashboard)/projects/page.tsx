import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus, FolderOpen, History } from "lucide-react";
import { ProjectsClient } from "./ProjectsClient";
import { listProjects } from "@vbt/core";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function ProjectsPage() {
  const user = await requireAuth();
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);

  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const orgId = effectiveOrgId ?? user.activeOrgId ?? user.orgId ?? "";
  if (!orgId) return null;

  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: orgId,
    isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
  };
  const { projects, total } = await listProjects(prisma, tenantCtx, {
    limit: 50,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("projects.title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("projects.projectsCount", { count: total })}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/projects/logs"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <History className="w-4 h-4" /> {t("projects.logs")}
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-vbt-blue/90"
          >
            <Plus className="w-4 h-4" /> {t("projects.newProject")}
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t("projects.noProjects")}</p>
          <Link href="/projects/new" className="text-vbt-orange text-sm hover:underline mt-2 block">
            {t("projects.createFirstLink")}
          </Link>
        </div>
      ) : (
        <ProjectsClient projects={projects} total={total} />
      )}
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FolderOpen, History } from "lucide-react";
import { ProjectsClient } from "./ProjectsClient";
import { listProjects } from "@vbt/core";
import type { SessionUser } from "@/lib/auth";

export default async function ProjectsPage() {
  const user = await requireAuth();
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} projects</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/projects/logs"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <History className="w-4 h-4" /> Logs
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-vbt-blue/90"
          >
            <Plus className="w-4 h-4" /> New Project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No projects yet</p>
          <Link href="/projects/new" className="text-vbt-orange text-sm hover:underline mt-2 block">
            Create your first project →
          </Link>
        </div>
      ) : (
        <ProjectsClient projects={projects} total={total} />
      )}
    </div>
  );
}

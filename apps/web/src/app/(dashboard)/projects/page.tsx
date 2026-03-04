import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FolderOpen, History } from "lucide-react";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const user = await requireAuth();
  const orgId = (user as any).orgId;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { orgId, isArchived: false },
      include: {
        clientRecord: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        baselineQuote: { select: { id: true, quoteNumber: true, fobUsd: true } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.project.count({ where: { orgId, isArchived: false } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} active projects</p>
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
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

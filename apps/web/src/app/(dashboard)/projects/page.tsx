import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FolderOpen, MapPin, User } from "lucide-react";

export default async function ProjectsPage() {
  const user = await requireAuth();
  const orgId = (user as any).orgId;

  const { projects, total } = await (async () => {
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: { orgId, isArchived: false },
        include: { _count: { select: { quotes: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.project.count({ where: { orgId, isArchived: false } }),
    ]);
    return { projects, total };
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} active projects</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {p._count.quotes} quote{p._count.quotes !== 1 ? "s" : ""}
                </span>
              </div>
              <h3 className="font-semibold text-gray-800">{p.name}</h3>
              {p.client && (
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                  <User className="w-3.5 h-3.5" />
                  {p.client}
                </div>
              )}
              {p.location && (
                <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {p.location}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                <span>S80: {p.wallAreaM2S80.toFixed(0)} m²</span>
                <span>S150: {p.wallAreaM2S150.toFixed(0)} m²</span>
                <span>S200: {p.wallAreaM2S200.toFixed(0)} m²</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

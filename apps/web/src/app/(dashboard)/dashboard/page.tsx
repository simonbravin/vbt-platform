import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { FileText, FolderOpen, Package, TrendingUp, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireAuth();
  const orgId = (user as any).orgId;

  // Stats
  const [projectCount, quoteCount, draftCount, sentCount] = await Promise.all([
    prisma.project.count({ where: { orgId, isArchived: false } }),
    prisma.quote.count({ where: { orgId } }),
    prisma.quote.count({ where: { orgId, status: "DRAFT" } }),
    prisma.quote.count({ where: { orgId, status: "SENT" } }),
  ]);

  const recentQuotes = await prisma.quote.findMany({
    where: { orgId },
    include: { project: true, country: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentProjects = await prisma.project.findMany({
    where: { orgId, isArchived: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const pendingUsers = (user as any).role === "SUPERADMIN"
    ? await prisma.user.count({ where: { status: "PENDING" } })
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Welcome back, {(user as any).name ?? (user as any).email}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-blue text-white rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </Link>
        </div>
      </div>

      {/* Pending users alert */}
      {pendingUsers > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-600 font-bold text-sm">{pendingUsers}</span>
            </div>
            <div>
              <p className="font-medium text-amber-800">
                {pendingUsers} user{pendingUsers !== 1 ? "s" : ""} pending approval
              </p>
              <p className="text-amber-600 text-sm">Review and approve new accounts</p>
            </div>
          </div>
          <Link
            href="/admin/users"
            className="text-amber-700 hover:text-amber-900 text-sm font-medium underline"
          >
            Review →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Projects",
            value: projectCount,
            icon: FolderOpen,
            color: "text-blue-600",
            bg: "bg-blue-50",
            href: "/projects",
          },
          {
            label: "Total Quotes",
            value: quoteCount,
            icon: FileText,
            color: "text-purple-600",
            bg: "bg-purple-50",
            href: "/quotes",
          },
          {
            label: "Draft Quotes",
            value: draftCount,
            icon: TrendingUp,
            color: "text-amber-600",
            bg: "bg-amber-50",
            href: "/quotes?status=DRAFT",
          },
          {
            label: "Sent Quotes",
            value: sentCount,
            icon: Package,
            color: "text-green-600",
            bg: "bg-green-50",
            href: "/quotes?status=SENT",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-gray-500 text-sm mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Recent Quotes</h2>
            <Link href="/quotes" className="text-sm text-vbt-orange hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentQuotes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No quotes yet</p>
                <Link href="/quotes/new" className="text-vbt-orange text-sm hover:underline mt-1 block">
                  Create your first quote
                </Link>
              </div>
            ) : (
              recentQuotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/quotes/${quote.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">
                      {quote.quoteNumber ?? quote.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {quote.project.name} • {quote.country?.name ?? "No destination"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatCurrency(quote.landedDdpUsd)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        quote.status === "SENT"
                          ? "bg-green-100 text-green-700"
                          : quote.status === "DRAFT"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {quote.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Recent Projects</h2>
            <Link href="/projects" className="text-sm text-vbt-orange hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentProjects.length === 0 ? (
              <div className="p-8 text-center">
                <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No projects yet</p>
                <Link href="/projects/new" className="text-vbt-orange text-sm hover:underline mt-1 block">
                  Create your first project
                </Link>
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{project.name}</p>
                    <p className="text-gray-400 text-xs">
                      {project.client ?? "No client"} • {project.location ?? "No location"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {project.wallAreaM2Total.toFixed(0)} m²
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

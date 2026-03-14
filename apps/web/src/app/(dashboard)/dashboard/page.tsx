import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, FolderOpen, Package, TrendingUp, Plus, DollarSign, Send } from "lucide-react";
import { GoalKpiCard } from "@/components/dashboard/GoalKpiCard";
import { formatCurrency } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

export default async function DashboardPage() {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth();
  } catch {
    redirect("/login");
  }

  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const organizationId = effectiveOrgId ?? (user as { activeOrgId?: string | null; orgId?: string | null }).activeOrgId ?? (user as { orgId?: string | null }).orgId;
  if (organizationId == null || organizationId === "") {
    redirect("/login");
  }

  let projectCount = 0;
  let quoteCount = 0;
  let draftCount = 0;
  let sentCount = 0;
  let salesYtd = 0;
  let quotesSentYtd = 0;
  let recentQuotes: Awaited<ReturnType<typeof prisma.quote.findMany>> = [];
  let recentProjects: Awaited<ReturnType<typeof prisma.project.findMany>> = [];
  let pendingUsers = 0;

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  try {
    [projectCount, quoteCount, draftCount, sentCount, quotesSentYtd] = await Promise.all([
      prisma.project.count({ where: { organizationId, status: { not: "lost" } } }),
      prisma.quote.count({ where: { organizationId } }),
      prisma.quote.count({ where: { organizationId, status: "draft" } }),
      prisma.quote.count({ where: { organizationId, status: "sent" } }),
      prisma.quote.count({ where: { organizationId, status: "sent", createdAt: { gte: startOfYear } } }),
    ]);

    recentQuotes = await prisma.quote.findMany({
      where: { organizationId },
      include: { project: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    recentProjects = await prisma.project.findMany({
      where: { organizationId, status: { not: "lost" } },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  } catch (err) {
    console.error("Dashboard data fetch error:", err);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-800 font-medium">Unable to load dashboard data</p>
          <p className="text-amber-700 text-sm mt-1">Please try again or contact support if the problem persists.</p>
          <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200">
            Retry
          </Link>
        </div>
      </div>
    );
  }

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

      {/* Goal KPI (partner sales target progress) */}
      <GoalKpiCard />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
            href: "/quotes?status=draft",
          },
          {
            label: "Sent Quotes",
            value: sentCount,
            icon: Package,
            color: "text-green-600",
            bg: "bg-green-50",
            href: "/quotes?status=sent",
          },
          {
            label: "Sales (YTD)",
            value: formatCurrency(salesYtd),
            icon: DollarSign,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            href: "/sales",
          },
          {
            label: "Quotes sent (YTD)",
            value: quotesSentYtd,
            icon: Send,
            color: "text-vbt-blue",
            bg: "bg-blue-50",
            href: "/quotes?status=sent",
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
                      {(quote as { quoteNumber?: string }).quoteNumber ?? quote.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {(quote as { project?: { projectName?: string; name?: string } | null }).project?.projectName ?? (quote as { project?: { name?: string } | null }).project?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatCurrency((quote as { totalPrice?: number }).totalPrice ?? 0)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        quote.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : quote.status === "draft"
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
                    <p className="font-medium text-gray-800 text-sm">{(project as { projectName?: string; name?: string }).projectName ?? (project as { name?: string }).name ?? "—"}</p>
                    <p className="text-gray-400 text-xs">
                      {(project as { client?: { name: string } | null }).client?.name ?? "No client"} • {(project as { city?: string; countryCode?: string }).city ?? (project as { countryCode?: string }).countryCode ?? "No location"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {(Number((project as { estimatedTotalAreaM2?: number }).estimatedTotalAreaM2) || 0).toFixed(0)} m²
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

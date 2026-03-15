import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FileText, FolderOpen, Package, TrendingUp, Plus, DollarSign, Send } from "lucide-react";
import { GoalKpiCard } from "@/components/dashboard/GoalKpiCard";
import { formatCurrency } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);
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
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
        <div className="bg-alert-warning border border-alert-warningBorder rounded-xl p-6 text-center">
          <p className="text-foreground font-medium">{t("dashboard.errorLoad")}</p>
          <p className="text-muted-foreground text-sm mt-1">{t("dashboard.errorHelp")}</p>
          <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80">
            {t("common.retry")}
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
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("dashboard.welcome")}, {(user as any).name ?? (user as any).email}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("dashboard.newProject")}
          </Link>
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-vbt-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("dashboard.newQuote")}
          </Link>
        </div>
      </div>

      {/* Pending users alert */}
      {pendingUsers > 0 && (
        <div className="bg-alert-warning border border-alert-warningBorder rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <span className="text-foreground font-bold text-sm">{pendingUsers}</span>
            </div>
            <div>
              <p className="font-medium text-foreground">
                {t("dashboard.pendingUsersText", { count: pendingUsers })}
              </p>
              <p className="text-muted-foreground text-sm">{t("dashboard.pendingReview")}</p>
            </div>
          </div>
          <Link
            href="/superadmin/admin/users"
            className="text-primary hover:opacity-90 text-sm font-medium underline"
          >
            {t("dashboard.review")}
          </Link>
        </div>
      )}

      {/* Goal KPI (partner sales target progress) */}
      <GoalKpiCard />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            label: t("dashboard.activeProjects"),
            value: projectCount,
            icon: FolderOpen,
            href: "/projects",
          },
          {
            label: t("dashboard.totalQuotes"),
            value: quoteCount,
            icon: FileText,
            href: "/quotes",
          },
          {
            label: t("dashboard.draftQuotes"),
            value: draftCount,
            icon: TrendingUp,
            href: "/quotes?status=draft",
          },
          {
            label: t("dashboard.sentQuotes"),
            value: sentCount,
            icon: Package,
            href: "/quotes?status=sent",
          },
          {
            label: t("dashboard.salesYtd"),
            value: formatCurrency(salesYtd),
            icon: DollarSign,
            href: "/sales",
          },
          {
            label: t("dashboard.quotesSentYtd"),
            value: quotesSentYtd,
            icon: Send,
            href: "/quotes?status=sent",
          },
        ].map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <div className="bg-card rounded-xl shadow-sm border border-border">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{t("dashboard.recentQuotes")}</h2>
            <Link href="/quotes" className="text-sm text-primary hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentQuotes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{t("dashboard.noQuotes")}</p>
                <Link href="/quotes/new" className="text-primary text-sm hover:underline mt-1 block">
                  {t("dashboard.createFirstQuote")}
                </Link>
              </div>
            ) : (
              recentQuotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/quotes/${quote.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {(quote as { quoteNumber?: string }).quoteNumber ?? quote.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {(quote as { project?: { projectName?: string; name?: string } | null }).project?.projectName ?? (quote as { project?: { name?: string } | null }).project?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency((quote as { totalPrice?: number }).totalPrice ?? 0)}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                      {quote.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-card rounded-xl shadow-sm border border-border">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{t("dashboard.recentProjects")}</h2>
            <Link href="/projects" className="text-sm text-primary hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentProjects.length === 0 ? (
              <div className="p-8 text-center">
                <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{t("dashboard.noProjects")}</p>
                <Link href="/projects/new" className="text-primary text-sm hover:underline mt-1 block">
                  {t("dashboard.createFirstProject")}
                </Link>
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">{(project as { projectName?: string; name?: string }).projectName ?? (project as { name?: string }).name ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">
                      {(project as { client?: { name: string } | null }).client?.name ?? t("dashboard.noClient")} • {(project as { city?: string; countryCode?: string }).city ?? (project as { countryCode?: string }).countryCode ?? t("dashboard.noLocation")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
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

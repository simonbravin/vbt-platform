import { requireAuth, formatCurrency } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FileText, FolderOpen, Package, TrendingUp, Plus, DollarSign, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, quoteStatusTone } from "@/components/ui/status-badge";
import { SaleOrderStatus } from "@vbt/db";
import { GoalKpiCard } from "@/components/dashboard/GoalKpiCard";
import { RefreshPageButton } from "@/components/dashboard/RefreshPageButton";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";
import { normalizeQuoteStatus } from "@vbt/core";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ access_denied?: string }> | { access_denied?: string } };

const recentQuoteSelect = {
  id: true,
  quoteNumber: true,
  status: true,
  totalPrice: true,
  project: { select: { projectName: true } },
} as const;

const recentProjectSelect = {
  id: true,
  projectName: true,
  city: true,
  countryCode: true,
  estimatedTotalAreaM2: true,
  client: { select: { name: true } },
} as const;

function quoteStatusTranslationKey(status: string): string {
  const n = normalizeQuoteStatus(status) ?? "draft";
  const map: Record<string, string> = {
    draft: "quotes.draft",
    sent: "quotes.sent",
    accepted: "quotes.accepted",
    rejected: "quotes.rejected",
    expired: "quotes.expired",
    archived: "quotes.archived",
  };
  return map[n] ?? "quotes.draft";
}

export default async function DashboardPage(props: PageProps) {
  const raw = props.searchParams;
  const searchParams = raw instanceof Promise ? await raw : raw;
  const accessDeniedSuperadmin = searchParams?.access_denied === "superadmin";

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
  const organizationId = effectiveOrgId ?? getEffectiveOrganizationId(user);
  if (organizationId == null || organizationId === "") {
    redirect("/login");
  }

  let projectCount = 0;
  let quoteCount = 0;
  let draftCount = 0;
  let sentCount = 0;
  let salesYtd = 0;
  let quotesSentYtd = 0;
  let recentQuotes: Awaited<ReturnType<typeof prisma.quote.findMany<{ select: typeof recentQuoteSelect }>>> = [];
  let recentProjects: Awaited<ReturnType<typeof prisma.project.findMany<{ select: typeof recentProjectSelect }>>> = [];
  const fallbackDisplayName = locale === "es" ? "Usuario" : "User";
  let displayName: string | null = null;
  const sessionUserId = (user as { userId?: string; id?: string }).userId ?? (user as { id?: string }).id;
  if (sessionUserId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { fullName: true },
      });
      displayName = dbUser?.fullName?.trim() || null;
    } catch {
      displayName = null;
    }
  }

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  let statsLoadError: string | null = null;

  try {
    [projectCount, quoteCount, draftCount, sentCount, quotesSentYtd, salesYtd] = await Promise.all([
      prisma.project.count({ where: { organizationId, status: { not: "lost" } } }),
      prisma.quote.count({ where: { organizationId } }),
      prisma.quote.count({ where: { organizationId, status: "draft" } }),
      prisma.quote.count({ where: { organizationId, status: "sent" } }),
      prisma.quote.count({ where: { organizationId, status: "sent", createdAt: { gte: startOfYear } } }),
      prisma.sale
        .aggregate({
          where: {
            organizationId,
            status: { not: SaleOrderStatus.CANCELLED },
            createdAt: { gte: startOfYear },
          },
          _sum: { landedDdpUsd: true },
        })
        .then((a) => Number(a._sum.landedDdpUsd ?? 0)),
    ]);
  } catch (err) {
    console.error("Dashboard stats fetch error:", err);
    statsLoadError = err instanceof Error ? err.message : String(err);
  }

  const [quotesResult, projectsResult] = await Promise.all([
    (async () => {
      try {
        return await prisma.quote.findMany({
          where: { organizationId },
          select: recentQuoteSelect,
          orderBy: { createdAt: "desc" },
          take: 5,
        });
      } catch (err) {
        console.error("Dashboard recent quotes fetch error:", err);
        return [];
      }
    })(),
    (async () => {
      try {
        return await prisma.project.findMany({
          where: { organizationId, status: { not: "lost" } },
          select: recentProjectSelect,
          orderBy: { createdAt: "desc" },
          take: 5,
        });
      } catch (err) {
        console.error("Dashboard recent projects fetch error:", err);
        return [];
      }
    })(),
  ]);

  recentQuotes = quotesResult;
  recentProjects = projectsResult;

  return (
    <div className="space-y-8">
      {accessDeniedSuperadmin && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-caption text-destructive">
          {t("dashboard.accessDeniedSuperadmin")}
        </div>
      )}
      {statsLoadError && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-alert-warningBorder bg-alert-warning px-4 py-3 text-caption">
          <p className="text-foreground">
            <span className="font-medium">{t("dashboard.errorLoad")}</span>
            <span className="text-muted-foreground ml-1">{t("dashboard.errorHelp")}</span>
          </p>
          <RefreshPageButton
            label={t("common.retry")}
            className="shrink-0 rounded-full border border-border/80 bg-card px-4 py-2 text-[15px] font-medium text-foreground hover:bg-muted"
          />
        </div>
      )}
      <PageHeader
        title={t("dashboard.title")}
        description={`${t("dashboard.welcome")}, ${displayName ?? fallbackDisplayName}`}
        actions={
          <>
            <Button asChild className="gap-2 border border-primary/20">
              <Link href="/quotes/wizard">
                <Plus className="h-4 w-4 shrink-0" />
                {t("dashboard.newQuote")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/projects/new">
                <Plus className="h-4 w-4 shrink-0" />
                {t("dashboard.newProject")}
              </Link>
            </Button>
          </>
        }
      />

      {/* Goal KPI (partner sales target progress) */}
      <GoalKpiCard />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            id: "stat-projects",
            label: t("dashboard.activeProjects"),
            value: projectCount,
            icon: FolderOpen,
            href: "/projects",
          },
          {
            id: "stat-quotes-total",
            label: t("dashboard.totalQuotes"),
            value: quoteCount,
            icon: FileText,
            href: "/quotes",
          },
          {
            id: "stat-quotes-draft",
            label: t("dashboard.draftQuotes"),
            value: draftCount,
            icon: TrendingUp,
            href: "/quotes?status=draft",
          },
          {
            id: "stat-quotes-sent",
            label: t("dashboard.sentQuotes"),
            value: sentCount,
            icon: Package,
            href: "/quotes?status=sent",
          },
          {
            id: "stat-sales-ytd",
            label: t("dashboard.salesYtd"),
            value: formatCurrency(salesYtd),
            icon: DollarSign,
            href: "/sales",
          },
          {
            id: "stat-quotes-sent-ytd",
            label: t("dashboard.quotesSentYtd"),
            value: quotesSentYtd,
            icon: Send,
            href: "/quotes?status=sent",
          },
        ].map((stat) => (
          <Link
            key={stat.id}
            href={stat.href}
            className="rounded-lg border border-border/80 bg-card p-6 transition-colors hover:shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{stat.value}</p>
            <p className="mt-2 text-micro uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <div className="rounded-lg border border-border/80 bg-card">
          <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/25">
            <h2 className="text-caption font-semibold uppercase tracking-wide text-foreground">{t("dashboard.recentQuotes")}</h2>
            <Link href="/quotes" className="text-sm text-primary hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentQuotes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{t("dashboard.noQuotes")}</p>
                <Link href="/quotes/wizard" className="text-primary text-sm hover:underline mt-2 block">
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
                    <p className="font-medium text-foreground text-sm">{quote.quoteNumber}</p>
                    <p className="text-muted-foreground text-xs">{quote.project.projectName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(quote.totalPrice)}</p>
                    <StatusBadge tone={quoteStatusTone(quote.status)}>
                      {t(quoteStatusTranslationKey(quote.status) as "quotes.draft")}
                    </StatusBadge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="rounded-lg border border-border/80 bg-card">
          <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/25">
            <h2 className="text-caption font-semibold uppercase tracking-wide text-foreground">{t("dashboard.recentProjects")}</h2>
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
                    <p className="font-medium text-foreground text-sm">{project.projectName}</p>
                    <p className="text-muted-foreground text-xs">
                      {project.client?.name ?? t("dashboard.noClient")} •{" "}
                      {project.city ?? project.countryCode ?? t("dashboard.noLocation")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {(Number(project.estimatedTotalAreaM2) || 0).toFixed(0)} m²
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

import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { QuotesClient } from "./QuotesClient";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";
import { normalizeQuoteStatus } from "@vbt/core";

export default async function QuotesPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requireAuth();
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);

  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const organizationId = effectiveOrgId ?? getEffectiveOrganizationId(user);
  if (!organizationId) return null;

  const statusFilter = searchParams.status ? normalizeQuoteStatus(searchParams.status) : null;

  type QuoteWithProject = Awaited<
    ReturnType<
      typeof prisma.quote.findMany<{
        select: {
          id: true;
          quoteNumber: true;
          status: true;
          totalPrice: true;
          totalKits: true;
          numContainers: true;
          createdAt: true;
          project: {
            select: { projectName: true; id: true; countryCode: true; client: { select: { name: true } } };
          };
        };
      }>
    >
  >;
  let quotes: QuoteWithProject = [];
  let dataLoadError: string | null = null;

  try {
    quotes = await prisma.quote.findMany({
      where: {
        organizationId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        totalPrice: true,
        totalKits: true,
        numContainers: true,
        createdAt: true,
        project: {
          select: { projectName: true, id: true, countryCode: true, client: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (err) {
    console.error("Quotes page data fetch error:", err);
    dataLoadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-5">
      {dataLoadError && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-alert-warningBorder bg-alert-warning px-4 py-3 text-sm text-foreground">
          <p className="text-foreground">
            <span className="font-medium">{t("dashboard.errorLoad")}</span>
            <span className="text-muted-foreground ml-1">{t("dashboard.errorHelp")}</span>
          </p>
          <Link href="/quotes" className="shrink-0 px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 border border-border">
            {t("common.retry")}
          </Link>
        </div>
      )}
      <PageHeader
        title={t("quotes.title")}
        description={t("quotes.quotesCount", { count: quotes.length })}
        actions={
          <Button asChild className="shrink-0 gap-2 border border-primary/20">
            <Link href="/quotes/wizard">
              <Plus className="h-4 w-4 shrink-0" /> {t("quotes.newQuote")}
            </Link>
          </Button>
        }
      />

      <QuotesClient quotes={quotes} initialStatus={statusFilter ?? undefined} />
    </div>
  );
}

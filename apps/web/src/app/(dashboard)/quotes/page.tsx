import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { QuotesClient } from "./QuotesClient";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";
import { normalizeQuoteStatus } from "@vbt/core";

const STATUS_KEYS: Record<string, string> = {
  draft: "quotes.draft",
  sent: "quotes.sent",
  accepted: "quotes.accepted",
  rejected: "quotes.rejected",
  expired: "quotes.expired",
  archived: "quotes.archived",
};

export default async function QuotesPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requireAuth();
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);

  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const organizationId = effectiveOrgId ?? getEffectiveOrganizationId(user);
  if (!organizationId) return null;

  type QuoteWithProject = Awaited<
    ReturnType<
      typeof prisma.quote.findMany<{
        include: { project: { select: { projectName: true; id: true; countryCode: true; client: { select: { name: true } } } } };
      }>
    >
  >;
  let quotes: QuoteWithProject = [];
  let dataLoadError: string | null = null;

  try {
    quotes = await prisma.quote.findMany({
      where: {
        organizationId,
        ...(searchParams.status
          ? { status: searchParams.status as "draft" | "sent" | "accepted" | "rejected" | "expired" }
          : {}),
      },
      include: {
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

  const statuses = ["draft", "sent", "accepted", "rejected", "expired", "archived"];

  return (
    <div className="space-y-5">
      {dataLoadError && quotes.length > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-sm px-4 py-3 text-sm flex items-center justify-between gap-4 flex-wrap">
          <p className="text-foreground">
            <span className="font-medium">{t("dashboard.errorLoad")}</span>
            <span className="text-muted-foreground ml-1">{t("dashboard.errorHelp")}</span>
          </p>
          <Link href="/quotes" className="shrink-0 px-3 py-1.5 bg-muted text-foreground rounded-sm text-sm font-medium hover:bg-muted/80 border border-border">
            {t("common.retry")}
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("quotes.title")}</h1>
          <p className="text-muted-foreground mt-1 font-mono text-[11px] tabular-nums uppercase tracking-wider">
            {t("quotes.quotesCount", { count: quotes.length })}
          </p>
        </div>
        <Link
          href="/quotes/create"
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start border border-orange-600/30 bg-vbt-orange px-4 py-2.5 text-sm font-semibold text-white rounded-sm hover:brightness-110 sm:self-auto"
        >
          <Plus className="h-4 w-4 shrink-0" /> {t("quotes.newQuote")}
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap border border-border/60 rounded-sm p-1 bg-muted/30 w-fit max-w-full">
        <Link
          href="/quotes"
          className={`px-3 py-1.5 rounded-sm text-xs font-mono font-semibold uppercase tracking-wider transition-colors ${
            !searchParams.status
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          }`}
        >
          {t("quotes.all")}
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/quotes?status=${s}`}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono font-semibold uppercase tracking-wider transition-colors ${
              searchParams.status === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            {t(STATUS_KEYS[s] ?? s)}
          </Link>
        ))}
      </div>

      <QuotesClient quotes={quotes} initialStatus={searchParams.status} />
    </div>
  );
}

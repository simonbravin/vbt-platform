import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { STATIC_COUNTRIES } from "@/lib/countries";
import { cookies } from "next/headers";
import Link from "next/link";
import { ReportsClient } from "./ReportsClient";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);
  const countries = STATIC_COUNTRIES.map((c) => ({ id: c.code, name: c.name, code: c.code }));
  let clients: { id: string; name: string }[] = [];
  let dataLoadError: string | null = null;
  let user: SessionUser | null = null;
  let organizationId: string | undefined;
  let canSendReport = false;

  try {
    const sessionUser = await requireAuth();
    user = sessionUser as SessionUser;
    const effectiveOrgId = await getEffectiveActiveOrgId(sessionUser as SessionUser);
    organizationId = effectiveOrgId ?? getEffectiveOrganizationId(sessionUser) ?? undefined;
    canSendReport = user.role === "org_admin" || !!(user as SessionUser).isPlatformSuperadmin;

    if (organizationId) {
      clients = await prisma.client.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    }
  } catch (err) {
    if ((err as Error)?.message === "NEXT_REDIRECT") throw err;
    console.error("Reports page data fetch error:", err);
    dataLoadError = err instanceof Error ? err.message : String(err);
  }

  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  const sessionUser = user as SessionUser;
  if (!canSendReport) {
    canSendReport = sessionUser.role === "org_admin" || !!sessionUser.isPlatformSuperadmin;
  }

  return (
    <div className="space-y-6">
      {dataLoadError && clients.length > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4 flex-wrap">
          <p className="text-foreground">
            <span className="font-medium">{t("dashboard.errorLoad")}</span>
            <span className="text-muted-foreground ml-1">{t("dashboard.errorHelp")}</span>
          </p>
          <Link href="/reports" className="shrink-0 px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80">
            {t("common.retry")}
          </Link>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("partner.reports.title")}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t("partner.reports.subtitle")}</p>
      </div>
      <ReportsClient countries={countries} clients={clients} canSendReport={canSendReport} />
    </div>
  );
}

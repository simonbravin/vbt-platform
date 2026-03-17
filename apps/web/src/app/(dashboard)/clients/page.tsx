import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ClientsClient } from "./ClientsClient";
import type { SessionUser } from "@/lib/auth";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/translations";

export default async function ClientsPage() {
  const user = await requireAuth();
  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const orgId = effectiveOrgId ?? getEffectiveOrganizationId(user) ?? "";
  if (!orgId) return null;

  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);

  let clientsRows: Awaited<ReturnType<typeof prisma.client.findMany>> = [];
  let total = 0;
  let dataLoadError: string | null = null;

  try {
    const [rows, totalCount] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId: orgId },
        include: { _count: { select: { projects: true } } },
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.client.count({ where: { organizationId: orgId } }),
    ]);
    clientsRows = rows;
    total = totalCount;
  } catch (err) {
    console.error("Clients page data fetch error:", err);
    dataLoadError = err instanceof Error ? err.message : String(err);
  }

  const countries: { id: string; name: string; code: string }[] = [];
  const clients = clientsRows.map((c) => {
    const row = c as typeof c & { _count?: { projects: number } };
    return {
      ...row,
      legalName: null as string | null,
      country: row.countryCode ? { id: row.countryCode, name: row.countryCode, code: row.countryCode } : null,
      _count: row._count ?? { projects: 0 },
    };
  });

  return (
    <div className="space-y-6">
      {dataLoadError && (clients.length > 0 || total > 0) && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4 flex-wrap">
          <p className="text-foreground">
            <span className="font-medium">{t("dashboard.errorLoad")}</span>
            <span className="text-muted-foreground ml-1">{t("dashboard.errorHelp")}</span>
          </p>
          <Link href="/clients" className="shrink-0 px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80">
            {t("common.retry")}
          </Link>
        </div>
      )}
      <ClientsClient
        initialClients={clients}
        initialTotal={total}
        countries={countries}
      />
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Users, Warehouse, Truck, TrendingUp } from "lucide-react";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function SettingsHubPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);
  try {
    await requireAuth();
  } catch (e) {
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    redirect("/login");
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("partner.settings.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("partner.settings.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/settings/team"
          className="surface-card p-6 transition-colors hover:border-primary/40 flex items-start gap-4"
        >
          <div className="rounded-sm bg-primary/10 p-2">
            <Users className="h-6 w-6 text-vbt-blue" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{t("partner.settings.team")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.teamDescription")}</p>
            <span className="inline-block mt-2 text-sm font-medium text-vbt-blue">{t("partner.settings.open")}</span>
          </div>
        </Link>

        <Link
          href="/settings/warehouses"
          className="surface-card p-6 transition-colors hover:border-primary/40 flex items-start gap-4"
        >
          <div className="rounded-sm bg-primary/10 p-2">
            <Warehouse className="h-6 w-6 text-vbt-blue" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{t("partner.settings.warehouses")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.warehousesDescription")}</p>
            <span className="inline-block mt-2 text-sm font-medium text-vbt-blue">{t("partner.settings.open")}</span>
          </div>
        </Link>

        <Link
          href="/settings/freight"
          className="surface-card p-6 transition-colors hover:border-primary/40 flex items-start gap-4"
        >
          <div className="rounded-sm bg-primary/10 p-2">
            <Truck className="h-6 w-6 text-vbt-blue" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{t("partner.settings.freightRates")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.freightRatesDescription")}</p>
            <span className="inline-block mt-2 text-sm font-medium text-vbt-blue">{t("partner.settings.open")}</span>
          </div>
        </Link>

        <Link
          href="/settings/taxes"
          className="surface-card p-6 transition-colors hover:border-primary/40 flex items-start gap-4"
        >
          <div className="rounded-sm bg-primary/10 p-2">
            <TrendingUp className="h-6 w-6 text-vbt-blue" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{t("partner.settings.taxRules")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.taxRulesDescription")}</p>
            <span className="inline-block mt-2 text-sm font-medium text-vbt-blue">{t("partner.settings.open")}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Users, Warehouse, Truck, TrendingUp, DollarSign } from "lucide-react";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function SettingsHubPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);
  try {
    await requireAuth();
  } catch {
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
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-vbt-blue/30 hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="rounded-lg bg-vbt-blue/10 p-2">
            <Users className="h-6 w-6 text-vbt-blue" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{t("partner.settings.team")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.teamDescription")}</p>
            <span className="inline-block mt-2 text-sm font-medium text-vbt-blue">{t("partner.settings.open")}</span>
          </div>
        </Link>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <Warehouse className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">{t("partner.settings.warehouses")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.warehousesDescription")}</p>
              <p className="mt-2 text-xs text-gray-400">{t("partner.settings.availableInAdmin")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <Truck className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">{t("partner.settings.freightRates")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.freightRatesDescription")}</p>
              <p className="mt-2 text-xs text-gray-400">{t("partner.settings.availableInAdmin")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <TrendingUp className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">{t("partner.settings.taxRules")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.taxRulesDescription")}</p>
              <p className="mt-2 text-xs text-gray-400">{t("partner.settings.availableInAdmin")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <DollarSign className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">{t("partner.settings.pricing")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("partner.settings.pricingDescription")}</p>
              <p className="mt-2 text-xs text-gray-400">{t("partner.settings.configuredByAdmin")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

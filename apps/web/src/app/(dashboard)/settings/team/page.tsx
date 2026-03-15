import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TeamSettingsClient } from "./TeamSettingsClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function TeamSettingsPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("partner.settings.teamPageTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("partner.settings.teamPageSubtitle")}</p>
      </div>
      <TeamSettingsClient />
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SalesClient } from "./SalesClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function SalesPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("partner.sales.title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("partner.sales.subtitle")}</p>
      </div>
      <SalesClient />
    </div>
  );
}

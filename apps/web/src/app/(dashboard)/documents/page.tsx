import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DocumentsPartnerClient } from "./DocumentsPartnerClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function DocumentsPage() {
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
        <h1 className="text-2xl font-semibold text-foreground">{t("partner.documents.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("partner.documents.subtitle")}</p>
      </div>
      <DocumentsPartnerClient />
    </div>
  );
}

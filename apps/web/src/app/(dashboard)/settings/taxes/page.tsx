import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import TaxesPage from "@/app/(dashboard)/admin/taxes/page";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function SettingsTaxesPage() {
  try {
    await requireAuth();
  } catch (e) {
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    redirect("/login");
  }
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale = raw === "es" || raw === "en" ? raw : "en";
  const t = getT(locale);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-sm border border-border/60 p-2 hover:bg-muted/40"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
      </div>
      <p className="text-sm text-gray-500">{t("partner.settings.taxesPartnerIntro")}</p>
      <TaxesPage />
    </div>
  );
}

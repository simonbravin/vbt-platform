import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { EngineeringDetailClient } from "./EngineeringDetailClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function EngineeringDetailPage({ params }: { params: { id: string } }) {
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
      <div className="flex items-center gap-4">
        <Link href="/engineering" className="text-sm text-gray-500 hover:text-vbt-blue">{t("partner.engineering.back")}</Link>
      </div>
      <EngineeringDetailClient requestId={params.id} />
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { NewEngineeringRequestForm } from "./NewEngineeringRequestForm";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function NewEngineeringRequestPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value === "es" ? "es" : "en") as Locale;
  const t = getT(locale);
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="data-entry-page">
      <div className="flex items-center gap-4">
        <Link href="/engineering" className="text-sm text-muted-foreground hover:text-primary">{t("partner.engineering.back")}</Link>
        <h1 className="text-2xl font-semibold text-foreground">{t("partner.engineering.newTitle")}</h1>
      </div>
      <NewEngineeringRequestForm />
    </div>
  );
}

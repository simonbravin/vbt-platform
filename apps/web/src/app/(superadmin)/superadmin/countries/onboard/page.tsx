import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { CountryOnboardClient } from "./CountryOnboardClient";

export const dynamic = "force-dynamic";

export default async function CountryOnboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const { t } = await getServerT();

  return (
    <div className="data-entry-page">
      <div>
        <Link
          href="/superadmin/admin/countries"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("superadmin.page.backToCountries")}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.page.countryOnboardTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.page.countryOnboardSubtitle")}</p>
      </div>
      <CountryOnboardClient />
    </div>
  );
}

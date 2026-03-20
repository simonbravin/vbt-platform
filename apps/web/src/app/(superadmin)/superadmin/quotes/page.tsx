import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperadminQuotesListClient } from "./SuperadminQuotesListClient";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SuperadminQuotesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("nav.superadmin.quotes")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.page.quotesSubtitle")}</p>
      </div>
      <SuperadminQuotesListClient />
    </div>
  );
}

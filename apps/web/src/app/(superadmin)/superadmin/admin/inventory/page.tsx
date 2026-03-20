import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { SuperadminInventoryClient } from "./SuperadminInventoryClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export default async function SuperadminInventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as { isPlatformSuperadmin?: boolean };
  if (!user.isPlatformSuperadmin) redirect("/dashboard");

  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale = raw === "es" || raw === "en" ? raw : "en";
  const t = getT(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("superadmin.page.inventoryTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.page.inventorySubtitle")}</p>
      </div>
      <SuperadminInventoryClient />
    </div>
  );
}

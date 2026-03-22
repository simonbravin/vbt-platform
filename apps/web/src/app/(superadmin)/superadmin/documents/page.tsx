import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DocumentsAdminClient } from "./DocumentsAdminClient";
import { getT, LOCALE_COOKIE_NAME } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

export default async function SuperadminDocumentsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale = raw === "es" || raw === "en" ? raw : "en";
  const t = getT(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.page.documentsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.page.documentsSubtitle")}</p>
      </div>
      <DocumentsAdminClient />
    </div>
  );
}

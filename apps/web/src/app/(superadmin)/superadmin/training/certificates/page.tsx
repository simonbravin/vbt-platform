import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { TrainingCertificatesAdminClient } from "./TrainingCertificatesAdminClient";

export const dynamic = "force-dynamic";

export default async function SuperadminTrainingCertificatesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.certificates.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.certificates.pageSubtitle")}</p>
      </div>
      <TrainingCertificatesAdminClient />
    </div>
  );
}

import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InsightsHubClient } from "./InsightsHubClient";
import { getServerT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function SuperadminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.superadmin.analytics")}
        description={t("superadmin.page.insightsSubtitle")}
      />
      <Suspense fallback={null}>
        <InsightsHubClient />
      </Suspense>
    </div>
  );
}

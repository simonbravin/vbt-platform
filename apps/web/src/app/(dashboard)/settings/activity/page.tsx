import { ActivityFeedClient } from "@/app/(superadmin)/superadmin/activity/ActivityFeedClient";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsActivityPage() {
  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("partner.settings.activityLogTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("partner.settings.activityLogSubtitle")}</p>
      </div>
      <ActivityFeedClient showExport={false} headingKey="partner.settings.activityLogFeedHeading" />
    </div>
  );
}

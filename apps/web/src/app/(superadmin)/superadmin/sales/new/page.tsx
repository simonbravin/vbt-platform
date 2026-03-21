import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperadminNewSaleClient } from "./SuperadminNewSaleClient";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ organizationId?: string }> };

export default async function SuperadminNewSalePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const resolved = await searchParams;
  const initialOrganizationId = resolved.organizationId?.trim() ?? "";

  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.page.salesNewTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.page.salesNewSubtitle")}</p>
      </div>
      <SuperadminNewSaleClient initialOrganizationId={initialOrganizationId} />
    </div>
  );
}

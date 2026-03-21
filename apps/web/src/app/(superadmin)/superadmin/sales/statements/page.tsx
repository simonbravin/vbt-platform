import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatementsClient } from "@/app/(dashboard)/sales/statements/StatementsClient";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ organizationId?: string }> };

export default async function SuperadminSalesStatementsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const resolved = await searchParams;
  const organizationId = resolved.organizationId?.trim();
  if (!organizationId) redirect("/superadmin/sales");

  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/superadmin/sales"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("superadmin.page.backToSales")}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.page.salesStatementsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("partner.sales.page.statementsSubtitle")}</p>
      </div>
      <StatementsClient
        organizationId={organizationId}
        backHref="/superadmin/sales"
        saleDetailBasePath="/superadmin/sales"
      />
    </div>
  );
}

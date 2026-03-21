import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SaleDetailClient } from "@/app/(dashboard)/sales/[id]/SaleDetailClient";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SuperadminSaleDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

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
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.page.saleDetailTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superadmin.page.saleDetailSubtitle")}</p>
      </div>
      <SaleDetailClient
        saleId={params.id}
        backHref="/superadmin/sales"
        afterDeleteHref="/superadmin/sales"
        editHref={null}
        quoteLinkPrefix="/superadmin/quotes"
      />
    </div>
  );
}

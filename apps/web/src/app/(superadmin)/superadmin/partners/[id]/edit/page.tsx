import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { EditPartnerForm } from "./EditPartnerForm";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function EditPartnerPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const partner = await prisma.organization.findFirst({
    where: {
      id: params.id,
      organizationType: { in: ["commercial_partner", "master_partner"] },
    },
    include: { partnerProfile: true, territories: true },
  });

  if (!partner) notFound();

  const { t } = await getServerT();

  return (
    <div className="data-entry-page">
      <div>
        <Link
          href={`/superadmin/partners/${params.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("superadmin.page.backToPartner")}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{t("superadmin.page.editPartnerTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{partner.name}</p>
      </div>
      <EditPartnerForm
        partnerId={params.id}
        initialTerritories={(partner.territories ?? []).map((row) => ({
          id: row.id,
          countryCode: row.countryCode,
          region: row.region,
          territoryType: row.territoryType,
        }))}
        initial={{
          companyName: partner.name,
          contactName: partner.partnerProfile?.contactName ?? "",
          contactEmail: partner.partnerProfile?.contactEmail ?? "",
          website: partner.website ?? "",
          country: partner.countryCode ?? "",
          partnerType: partner.organizationType as "commercial_partner" | "master_partner",
          engineeringFeeMode: partner.partnerProfile?.engineeringFeeMode ?? "",
          status: partner.status ?? "active",
          visionLatamCommissionPct: partner.partnerProfile?.visionLatamCommissionPct != null ? String(partner.partnerProfile.visionLatamCommissionPct) : "",
          visionLatamCommissionFixedUsd: partner.partnerProfile?.visionLatamCommissionFixedUsd != null ? String(partner.partnerProfile.visionLatamCommissionFixedUsd) : "",
          moduleVisibility: (partner.partnerProfile as { moduleVisibility?: Record<string, boolean> | null } | null)?.moduleVisibility ?? null,
          enabledSystems: (partner.partnerProfile as { enabledSystems?: string[] | null } | null)?.enabledSystems ?? null,
          requireDeliveredEngineeringForQuotes:
            (partner.partnerProfile as { requireDeliveredEngineeringForQuotes?: boolean } | null)?.requireDeliveredEngineeringForQuotes ?? false,
        }}
      />
    </div>
  );
}

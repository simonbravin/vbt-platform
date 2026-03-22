import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PartnerDetailClient } from "./PartnerDetailClient";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string }; searchParams: Promise<{ inviteSent?: string }> };

export default async function PartnerDetailPage({ params, searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const inviteSent = resolvedSearchParams.inviteSent;
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
    <div className="space-y-6">
      <div>
        <Link
          href="/superadmin/partners"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("superadmin.page.backToPartners")}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{partner.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("superadmin.page.partnerDetailSubtitle")}
        </p>
      </div>
      <PartnerDetailClient
        partnerId={partner.id}
        inviteSent={inviteSent}
        initialPartner={{
          id: partner.id,
          name: partner.name,
          status: partner.status,
          countryCode: partner.countryCode,
          website: partner.website,
          partnerProfile: partner.partnerProfile
            ? {
                partnerType: partner.partnerProfile.partnerType,
                contactName: partner.partnerProfile.contactName,
                contactEmail: partner.partnerProfile.contactEmail,
                engineeringFeeMode: partner.partnerProfile.engineeringFeeMode,
                onboardingState: partner.partnerProfile.onboardingState,
                salesTargetAnnualUsd: partner.partnerProfile.salesTargetAnnualUsd,
                salesTargetAnnualM2: partner.partnerProfile.salesTargetAnnualM2,
              }
            : null,
          territories: partner.territories,
        }}
      />
    </div>
  );
}

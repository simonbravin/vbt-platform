import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { EditPartnerForm } from "./EditPartnerForm";

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
    include: { partnerProfile: true },
  });

  if (!partner) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/superadmin/partners/${params.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to partner
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit partner</h1>
        <p className="mt-1 text-sm text-gray-500">{partner.name}</p>
      </div>
      <EditPartnerForm
        partnerId={params.id}
        initial={{
          companyName: partner.name,
          contactName: partner.partnerProfile?.contactName ?? "",
          contactEmail: partner.partnerProfile?.contactEmail ?? "",
          website: partner.website ?? "",
          country: partner.countryCode ?? "",
          partnerType: partner.organizationType as "commercial_partner" | "master_partner",
          engineeringFeeMode: partner.partnerProfile?.engineeringFeeMode ?? "",
          status: partner.status ?? "active",
        }}
      />
    </div>
  );
}

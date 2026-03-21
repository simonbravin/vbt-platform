import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { SuperadminEngineeringDetailClient } from "../SuperadminEngineeringDetailClient";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function SuperadminEngineeringDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  const { t } = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/superadmin/engineering"
          className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("superadmin.engineeringDetail.backToList")}
        </Link>
      </div>
      <SuperadminEngineeringDetailClient requestId={params.id} />
    </div>
  );
}

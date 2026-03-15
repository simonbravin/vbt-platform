import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreatePartnerForm } from "./CreatePartnerForm";

export const dynamic = "force-dynamic";

export default async function NewPartnerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/superadmin/partners"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to partners
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Create partner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new partner organization. You can set territories and onboarding after creation.
        </p>
      </div>
      <CreatePartnerForm />
    </div>
  );
}

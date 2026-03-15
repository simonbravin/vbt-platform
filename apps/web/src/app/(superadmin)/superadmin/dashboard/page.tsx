import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperadminDashboardClient } from "./SuperadminDashboardClient";

export const dynamic = "force-dynamic";

export default async function SuperadminDashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global overview and partner performance
        </p>
      </div>
      <SuperadminDashboardClient />
    </div>
  );
}

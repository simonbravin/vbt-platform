import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GlobalReportsClient } from "./GlobalReportsClient";

export const dynamic = "force-dynamic";

export default async function SuperadminReportsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Global Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide KPIs and partner performance. Export to CSV or Excel.
        </p>
      </div>
      <GlobalReportsClient />
    </div>
  );
}

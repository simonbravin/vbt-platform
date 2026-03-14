import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnalyticsHubClient } from "./AnalyticsHubClient";

export const dynamic = "force-dynamic";

export default async function SuperadminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics & Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Global pipeline, partner performance, and quote analytics. Filter by partner and date.
        </p>
      </div>
      <AnalyticsHubClient />
    </div>
  );
}

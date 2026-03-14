import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActivityFeedClient } from "./ActivityFeedClient";

export const dynamic = "force-dynamic";

export default async function SuperadminActivityPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Global activity</h1>
        <p className="mt-1 text-sm text-gray-500">
          Recent platform activity across all partners. Use this to audit key events.
        </p>
      </div>
      <ActivityFeedClient />
    </div>
  );
}

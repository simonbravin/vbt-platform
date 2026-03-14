import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GlobalSettingsClient } from "./GlobalSettingsClient";

export const dynamic = "force-dynamic";

export default async function SuperadminSettingsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Global Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Default pricing, module visibility, and platform-wide configuration. Partner-specific overrides are set per partner in Partner → Parameters.
        </p>
      </div>
      <GlobalSettingsClient />
    </div>
  );
}

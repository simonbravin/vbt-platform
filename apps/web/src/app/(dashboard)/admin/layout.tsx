/**
 * Deprecated partner-IA tree. Superadmin country/tax/freight/catalog UIs live under
 * `/superadmin/admin/*` and re-export these pages. Middleware sends superadmins there.
 * Do not add partner-nav entries here; do not delete blindly (reexport-only).
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as { isPlatformSuperadmin?: boolean };
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");
  return <>{children}</>;
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const user = session.user as { role?: string; isPlatformSuperadmin?: boolean };
  const role = user.isPlatformSuperadmin ? "SUPERADMIN" : (user.role ?? "viewer");
  const canAccessSettings = role === "SUPERADMIN" || role === "org_admin";
  if (!canAccessSettings) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}

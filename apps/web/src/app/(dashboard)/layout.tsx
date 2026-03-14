import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@vbt/db";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    redirect("/login");
  }
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as {
    id?: string;
    userId?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    activeOrgId?: string | null;
    isPlatformSuperadmin?: boolean;
  };
  const effectiveOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  // No effective active org and not platform superadmin → pending / onboarding
  if (!effectiveOrgId && !user.isPlatformSuperadmin) {
    redirect("/pending");
  }

  // Resolve org name: use session name when effective org matches; when superadmin switched context, fetch org name
  let activeOrgName: string | null = (user as { activeOrgName?: string | null }).activeOrgName ?? null;
  if (effectiveOrgId && effectiveOrgId !== user.activeOrgId) {
    const org = await prisma.organization.findUnique({ where: { id: effectiveOrgId }, select: { name: true } });
    activeOrgName = org?.name ?? null;
  }

  const safeUser = {
    name: user.name ?? null,
    email: user.email ?? null,
    role: user.isPlatformSuperadmin ? "SUPERADMIN" : (typeof user.role === "string" ? user.role : "viewer"),
    activeOrgName,
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar role={safeUser.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={safeUser} activeOrgName={safeUser.activeOrgName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

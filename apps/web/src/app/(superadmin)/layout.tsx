import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@vbt/db";
import { SuperadminSidebar } from "@/components/layout/superadmin-sidebar";
import { TopBar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
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
  // Partners must never access superadmin: redirect and signal access denied
  if (!user.isPlatformSuperadmin) {
    redirect("/dashboard?access_denied=superadmin");
  }

  let userDisplayName: string | null = null;
  let hasAvatar = false;
  const sessionUserId = user.userId ?? user.id;
  if (sessionUserId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { fullName: true, image: true },
      });
      userDisplayName = dbUser?.fullName?.trim() || null;
      hasAvatar = Boolean(dbUser?.image?.trim());
    } catch {
      userDisplayName = null;
      hasAvatar = false;
    }
  }

  const safeUser = {
    name: userDisplayName,
    email: user.email ?? null,
    role: "SUPERADMIN",
  };
  return (
    <SidebarProvider className="relative min-h-svh w-full">
      <SuperadminSidebar
        userDisplayName={safeUser.name?.trim() || "Superadmin"}
        hasAvatar={hasAvatar}
        profileHref="/superadmin/settings/profile"
      />
      <SidebarInset className="min-h-svh min-w-0 overflow-hidden">
        <TopBar showContextSwitcher />
        <div className="app-main-scroll flex flex-1 flex-col overflow-y-auto bg-background">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

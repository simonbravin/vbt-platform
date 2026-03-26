import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@vbt/db";
import { SuperadminSidebar } from "@/components/layout/superadmin-sidebar";
import { TopBar } from "@/components/layout/topbar";

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
    <div className="flex h-screen bg-muted overflow-hidden">
      <SuperadminSidebar
        userDisplayName={safeUser.name?.trim() || "Superadmin"}
        hasAvatar={hasAvatar}
        profileHref="/superadmin/settings/profile"
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-l border-border/60">
        <TopBar showContextSwitcher />
        <main className="app-main-scroll flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}

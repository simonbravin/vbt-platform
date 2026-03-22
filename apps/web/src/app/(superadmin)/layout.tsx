import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

  const safeUser = {
    name: user.name ?? null,
    email: user.email ?? null,
    role: "SUPERADMIN",
  };

  return (
    <div className="flex h-screen bg-muted overflow-hidden">
      <SuperadminSidebar userDisplayName={safeUser.name?.trim() || safeUser.email?.trim() || null} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-l border-border/60">
        <TopBar user={safeUser} showContextSwitcher />
        <main className="app-main-scroll flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}

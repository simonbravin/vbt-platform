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
  if (!user.isPlatformSuperadmin) {
    redirect("/dashboard");
  }

  const safeUser = {
    name: user.name ?? null,
    email: user.email ?? null,
    role: "SUPERADMIN",
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <SuperadminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={safeUser} showContextSwitcher />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

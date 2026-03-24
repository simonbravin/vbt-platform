import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@vbt/db";
import { resolveTrainingModuleVisible } from "@vbt/core";
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
    activeOrgName?: string | null;
    isPlatformSuperadmin?: boolean;
  };

  try {
    // Partners only: superadmin must use superadmin portal, not partner layout
    if (user.isPlatformSuperadmin) {
      redirect("/superadmin/dashboard");
    }

    const effectiveOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
    // No effective active org → pending / onboarding
    if (!effectiveOrgId) {
      redirect("/pending");
    }

    // Resolve org name: only query when we have a valid id (never pass null to findUnique)
    let activeOrgName: string | null = user.activeOrgName ?? null;
    if (effectiveOrgId !== user.activeOrgId) {
      try {
        const org = await prisma.organization.findUnique({ where: { id: effectiveOrgId }, select: { name: true } });
        activeOrgName = org?.name ?? null;
      } catch {
        activeOrgName = user.activeOrgName ?? null;
      }
    }

    const safeUser = {
      name: user.name ?? null,
      email: user.email ?? null,
      role: typeof user.role === "string" ? user.role : "viewer",
      activeOrgName,
    };

    const showTrainingModule = await resolveTrainingModuleVisible(prisma, effectiveOrgId);

    return (
      <div className="flex h-screen bg-muted overflow-hidden">
        <Sidebar
          role={safeUser.role}
          userDisplayName={safeUser.name?.trim() || safeUser.email?.trim() || null}
          showTrainingNav={showTrainingModule}
        />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-l border-border/60">
          <TopBar user={safeUser} activeOrgName={safeUser.activeOrgName} />
          <main className="app-main-scroll flex-1 overflow-y-auto blueprint-canvas bg-background">{children}</main>
        </div>
      </div>
    );
  } catch (e) {
    // Next.js redirect() throws NEXT_REDIRECT; must rethrow so redirect works
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    console.error("[dashboard layout]", e);
    redirect("/login");
  }
}

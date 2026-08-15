import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@vbt/db";
import { resolvePartnerModuleVisibility } from "@vbt/core";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
    const effectiveOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);

    // Superadmin without an impersonated partner stays in the platform portal.
    // With vbt-active-org set, they can use the partner portal (VL as partner).
    if (user.isPlatformSuperadmin && !effectiveOrgId) {
      redirect("/superadmin/dashboard");
    }
    if (!effectiveOrgId) {
      redirect("/pending");
    }

    // Resolve org name: only query when we have a valid id (never pass null to findUnique)
    let activeOrgName: string | null = user.activeOrgName ?? null;
    let userDisplayName: string | null = null;
    let hasAvatar = false;
    if (user.isPlatformSuperadmin || effectiveOrgId !== user.activeOrgId) {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: effectiveOrgId },
          select: { name: true, organizationType: true },
        });
        if (user.isPlatformSuperadmin) {
          const isPartner =
            org?.organizationType === "commercial_partner" || org?.organizationType === "master_partner";
          if (!org || !isPartner) {
            redirect("/superadmin/dashboard");
          }
        }
        activeOrgName = org?.name ?? null;
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        activeOrgName = user.activeOrgName ?? null;
      }
    }
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
      // Superadmin impersonating a partner acts as org admin for nav/settings.
      role: user.isPlatformSuperadmin
        ? "org_admin"
        : typeof user.role === "string"
          ? user.role
          : "viewer",
      activeOrgName,
    };

    const moduleVisibility = await resolvePartnerModuleVisibility(prisma, effectiveOrgId);
    return (
      <SidebarProvider className="relative w-full">
        <Sidebar
          role={safeUser.role}
          userDisplayName={safeUser.name?.trim() || "Usuario"}
          hasAvatar={hasAvatar}
          profileHref="/profile"
          moduleVisibility={moduleVisibility}
        />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          <TopBar
            showContextSwitcher={!!user.isPlatformSuperadmin}
            portal="partner"
            activeOrgName={safeUser.activeOrgName}
          />
          <div className="app-main-scroll flex flex-1 flex-col overflow-y-auto bg-background">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    );
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.error("[dashboard layout]", e);
    redirect("/login");
  }
}

function isNextRedirect(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = "digest" in e ? (e as { digest?: unknown }).digest : undefined;
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return true;
  return (e as Error).message === "NEXT_REDIRECT";
}

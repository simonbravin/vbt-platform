import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveActiveOrgId } from "@/lib/tenant";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const user = session.user as { activeOrgId?: string | null; isPlatformSuperadmin?: boolean };
  const effectiveOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  // Superadmin with no partner context (cookie) → Superadmin Portal; else Partner dashboard
  if (user?.isPlatformSuperadmin && !effectiveOrgId) {
    redirect("/superadmin/dashboard");
  }
  redirect("/dashboard");
}

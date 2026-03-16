import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperadminProjectsListClient } from "./SuperadminProjectsListClient";

export const dynamic = "force-dynamic";

export default async function SuperadminProjectsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isPlatformSuperadmin?: boolean } | undefined;
  if (!user?.isPlatformSuperadmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Proyectos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ver todos los proyectos de todos los partners. Filtrar por empresa, país y estado.
        </p>
      </div>
      <SuperadminProjectsListClient />
    </div>
  );
}

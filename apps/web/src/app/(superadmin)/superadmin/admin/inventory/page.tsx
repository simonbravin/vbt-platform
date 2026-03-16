import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SuperadminInventoryClient } from "./SuperadminInventoryClient";

export default async function SuperadminInventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as { isPlatformSuperadmin?: boolean };
  if (!user.isPlatformSuperadmin) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Inventario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inventario Vision Latam y por partner. Ver niveles, transacciones, afectar por cotización y simular sobrante/faltante.
        </p>
      </div>
      <SuperadminInventoryClient />
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import FreightPage from "@/app/(dashboard)/admin/freight/page";

export default async function SettingsFreightPage() {
  try {
    await requireAuth();
  } catch (e) {
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-sm border border-border/60 p-2 hover:bg-muted/40"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Tarifas base de Vision Latam y las tuyas (si no usas los servicios cotizados por Vision Latam). Puedes agregar o editar solo tus propias tarifas.
      </p>
      <FreightPage />
    </div>
  );
}

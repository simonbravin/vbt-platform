import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TaxesPage from "@/app/(dashboard)/admin/taxes/page";

export default async function SettingsTaxesPage() {
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
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
      </div>
      <p className="text-sm text-gray-500">
        Reglas base por país (Vision Latam) y las tuyas. Puedes agregar o editar tus propias reglas para modificar % u otros valores por país.
      </p>
      <TaxesPage />
    </div>
  );
}

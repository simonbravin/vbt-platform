import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { EngineeringListClient } from "./EngineeringListClient";

export default async function EngineeringPage() {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Engineering requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Request and track engineering support for your projects.
        </p>
      </div>
      <EngineeringListClient />
    </div>
  );
}

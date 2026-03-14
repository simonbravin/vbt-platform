import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewEngineeringRequestForm } from "./NewEngineeringRequestForm";

export default async function NewEngineeringRequestPage() {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/engineering" className="text-sm text-gray-500 hover:text-vbt-blue">← Engineering</Link>
        <h1 className="text-2xl font-semibold text-gray-900">New engineering request</h1>
      </div>
      <NewEngineeringRequestForm />
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { TrainingPartnerClient } from "./TrainingPartnerClient";

export default async function TrainingPage() {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Training</h1>
        <p className="mt-1 text-sm text-gray-500">
          Training programs and your enrollments.
        </p>
      </div>
      <TrainingPartnerClient />
    </div>
  );
}

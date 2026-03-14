import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EngineeringDetailClient } from "./EngineeringDetailClient";

export default async function EngineeringDetailPage({ params }: { params: { id: string } }) {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/engineering" className="text-sm text-gray-500 hover:text-vbt-blue">← Engineering</Link>
      </div>
      <EngineeringDetailClient requestId={params.id} />
    </div>
  );
}

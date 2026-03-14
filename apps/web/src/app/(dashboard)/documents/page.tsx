import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { DocumentsPartnerClient } from "./DocumentsPartnerClient";

export default async function DocumentsPage() {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Document library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and download documents available to your organization.
        </p>
      </div>
      <DocumentsPartnerClient />
    </div>
  );
}

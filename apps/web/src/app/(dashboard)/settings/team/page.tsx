import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import { TeamSettingsClient } from "./TeamSettingsClient";

export default async function TeamSettingsPage() {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization members and invite new users.
        </p>
      </div>
      <TeamSettingsClient />
    </div>
  );
}

import { requireAuth } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Warehouse, Truck, TrendingUp, DollarSign } from "lucide-react";

export default async function SettingsHubPage() {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Organization settings, team, and operational configuration.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/settings/team"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-vbt-blue/30 hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="rounded-lg bg-vbt-blue/10 p-2">
            <Users className="h-6 w-6 text-vbt-blue" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Team</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage members and invite by email.</p>
            <span className="inline-block mt-2 text-sm font-medium text-vbt-blue">Open →</span>
          </div>
        </Link>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <Warehouse className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">Warehouses</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configure warehouses when enabled for your organization.</p>
              <p className="mt-2 text-xs text-gray-400">Available in Admin when enabled.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <Truck className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">Freight rates</h2>
              <p className="text-sm text-gray-500 mt-0.5">Freight rules when enabled for your organization.</p>
              <p className="mt-2 text-xs text-gray-400">Available in Admin when enabled.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <TrendingUp className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">Tax rules</h2>
              <p className="text-sm text-gray-500 mt-0.5">Tax configuration when enabled for your organization.</p>
              <p className="mt-2 text-xs text-gray-400">Available in Admin when enabled.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 opacity-90">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-gray-200 p-2">
              <DollarSign className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">Pricing</h2>
              <p className="text-sm text-gray-500 mt-0.5">Partner-specific markup and pricing when allowed.</p>
              <p className="mt-2 text-xs text-gray-400">Configured per partner by platform admin.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

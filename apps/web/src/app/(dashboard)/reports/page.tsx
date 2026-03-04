import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const user = await requireAuth();
  const orgId = (user as { orgId?: string }).orgId;

  const [countries, clients] = await Promise.all([
    prisma.countryProfile.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    orgId
      ? prisma.client.findMany({
          where: { orgId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Project pipeline and conversion metrics</p>
      </div>
      <ReportsClient countries={countries} clients={clients} />
    </div>
  );
}

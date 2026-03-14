import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { STATIC_COUNTRIES } from "@/lib/countries";
import { ReportsClient } from "./ReportsClient";
import type { SessionUser } from "@/lib/auth";

export default async function ReportsPage() {
  const user = await requireAuth();
  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const organizationId = effectiveOrgId ?? (user as { activeOrgId?: string; orgId?: string }).activeOrgId ?? (user as { orgId?: string }).orgId;

  const countries = STATIC_COUNTRIES.map((c) => ({ id: c.code, name: c.name, code: c.code }));
  const clients = organizationId
    ? await prisma.client.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const canSendReport = (user as SessionUser).role === "org_admin" || !!(user as SessionUser).isPlatformSuperadmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Project pipeline and conversion metrics</p>
      </div>
      <ReportsClient countries={countries} clients={clients} canSendReport={canSendReport} />
    </div>
  );
}

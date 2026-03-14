import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { ClientsClient } from "./ClientsClient";
import type { SessionUser } from "@/lib/auth";

export default async function ClientsPage() {
  const user = await requireAuth();
  const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
  const orgId = effectiveOrgId ?? user.activeOrgId ?? user.orgId ?? "";
  if (!orgId) return null;

  const [clientsRows, total] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { projects: true } } },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.client.count({ where: { organizationId: orgId } }),
  ]);
  const countries: { id: string; name: string; code: string }[] = [];
  const clients = clientsRows.map((c) => ({
    ...c,
    legalName: null as string | null,
    country: c.countryCode ? { id: c.countryCode, name: c.countryCode, code: c.countryCode } : null,
  }));

  return (
    <ClientsClient
      initialClients={clients}
      initialTotal={total}
      countries={countries}
    />
  );
}

import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { ClientsClient } from "./ClientsClient";

export default async function ClientsPage() {
  const user = await requireAuth();
  const orgId = (user as { orgId: string }).orgId;

  const [clients, total, countries] = await Promise.all([
    prisma.client.findMany({
      where: { orgId },
      include: {
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.client.count({ where: { orgId } }),
    prisma.countryProfile.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <ClientsClient
      initialClients={clients}
      initialTotal={total}
      countries={countries}
    />
  );
}

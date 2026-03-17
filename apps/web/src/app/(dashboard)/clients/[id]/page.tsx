import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientDetailActions } from "./ClientDetailActions";
import type { SessionUser } from "@/lib/auth";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
    const orgId = effectiveOrgId ?? getEffectiveOrganizationId(user) ?? "";
    if (!orgId) notFound();

    const [client] = await Promise.all([
      prisma.client.findFirst({
        where: { id: params.id, organizationId: orgId },
        include: {
          projects: {
            select: { id: true, projectName: true, status: true },
            orderBy: { updatedAt: "desc" },
          },
        },
      }),
    ]);
    const countries: { id: string; name: string; code: string }[] = [];

    if (!client) notFound();

    return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            {client.clientType && (
              <p className="text-gray-500 text-sm">{client.clientType}</p>
            )}
          </div>
        </div>
        <ClientDetailActions client={client} countries={countries} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Client details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {client.countryCode && (
            <>
              <dt className="text-gray-500">Country</dt>
              <dd className="text-gray-900">{client.countryCode}</dd>
            </>
          )}
          {client.city && (
            <>
              <dt className="text-gray-500">City</dt>
              <dd className="text-gray-900">{client.city}</dd>
            </>
          )}
          {client.phone && (
            <>
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{client.phone}</dd>
            </>
          )}
          {client.email && (
            <>
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">
                <a href={`mailto:${client.email}`} className="text-vbt-blue hover:underline">
                  {client.email}
                </a>
              </dd>
            </>
          )}
          {client.website && (
            <>
              <dt className="text-gray-500">Website</dt>
              <dd className="text-gray-900">
                <a
                  href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vbt-blue hover:underline"
                >
                  {client.website}
                </a>
              </dd>
            </>
          )}
          {client.notes && (
            <>
              <dt className="text-gray-500 sm:col-span-1">Notes</dt>
              <dd className="text-gray-900 sm:col-span-2">{client.notes}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">
          Projects ({client.projects.length})
        </h2>
        {client.projects.length === 0 ? (
          <p className="text-gray-500 text-sm">No projects linked to this client.</p>
        ) : (
          <ul className="space-y-2">
            {client.projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="text-vbt-blue hover:underline font-medium"
                >
                  {(p as { projectName: string }).projectName}
                </Link>
                {p.status && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({p.status})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
  } catch (e) {
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    notFound();
  }
}

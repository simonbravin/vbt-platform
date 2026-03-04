import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./ProjectDetailClient";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();
  const orgId = (user as { orgId?: string }).orgId;

  const project = await prisma.project.findFirst({
    where: { id: params.id, ...(orgId ? { orgId } : {}) },
    include: {
      clientRecord: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      baselineQuote: { select: { id: true, quoteNumber: true, fobUsd: true } },
      quotes: {
        include: { country: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  const serialized = {
    ...project,
    plannedStartDate: project.plannedStartDate?.toISOString?.() ?? null,
    soldAt: project.soldAt?.toISOString?.() ?? null,
  };

  return <ProjectDetailClient initialProject={serialized as any} />;
}

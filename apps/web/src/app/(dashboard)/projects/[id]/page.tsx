import { requireAuth } from "@/lib/utils";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./ProjectDetailClient";
import { getProjectById } from "@vbt/core";
import type { SessionUser } from "@/lib/auth";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveActiveOrgId(user as SessionUser);
    const orgId = effectiveOrgId ?? getEffectiveOrganizationId(user) ?? "";
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: orgId || null,
      isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
    };

    const project = await getProjectById(prisma, tenantCtx, params.id);
    if (!project) notFound();

    const serialized = {
      ...project,
      expectedCloseDate: project.expectedCloseDate?.toISOString?.() ?? null,
    };

    const canOrgAdmin =
      (user as SessionUser).role === "org_admin" || (user as SessionUser).isPlatformSuperadmin === true;

    return <ProjectDetailClient initialProject={serialized as any} canOrgAdmin={canOrgAdmin} />;
  } catch (e) {
    if ((e as Error)?.message === "NEXT_REDIRECT") throw e;
    notFound();
  }
}

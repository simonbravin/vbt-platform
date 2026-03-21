import type { PrismaClient } from "@vbt/db";

/** ISO-2 country for document library filtering; `null` = org without country (strict platform rules); `undefined` = no active org (superadmin global). */
export async function resolveDocumentViewerCountryCode(
  prisma: PrismaClient,
  activeOrgId: string | null
): Promise<string | null | undefined> {
  if (!activeOrgId) return undefined;
  const org = await prisma.organization.findUnique({
    where: { id: activeOrgId },
    select: { countryCode: true },
  });
  const c = org?.countryCode?.trim();
  return c ? c.toUpperCase() : null;
}

import type { PrismaClient } from "@vbt/db";

/**
 * Returns the list of country codes allowed for a given organization (partner).
 * Combines Organization.countryCode (if set) and all PartnerTerritory.countryCode for that org.
 * Used to filter country dropdowns for clients and projects when the user is a partner.
 */
export async function getAllowedCountryCodes(
  prisma: PrismaClient,
  organizationId: string
): Promise<string[]> {
  const [org, territories] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { countryCode: true },
    }),
    prisma.partnerTerritory.findMany({
      where: { organizationId },
      select: { countryCode: true },
    }),
  ]);
  const codes = new Set<string>();
  if (org?.countryCode?.trim()) codes.add(org.countryCode.trim().toUpperCase());
  for (const t of territories) {
    if (t.countryCode?.trim()) codes.add(t.countryCode.trim().toUpperCase());
  }
  return Array.from(codes);
}

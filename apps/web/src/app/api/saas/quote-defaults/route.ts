import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQuoteDefaultsForOrg } from "@vbt/core";
import { getEffectiveActiveOrgId } from "@/lib/tenant";

/**
 * GET: Returns quote defaults for the current user's active org.
 * Partners receive only effective rates (factory × (1 + VL commission %)), never raw factory USD/m².
 * Used by the quote wizard so no rates are hardcoded in the client.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isPlatformSuperadmin?: boolean; activeOrgId?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  if (!activeOrgId) {
    return NextResponse.json(
      { error: "No active organization. Select an organization to create quotes." },
      { status: 400 }
    );
  }

  try {
    const defaults = await getQuoteDefaultsForOrg(prisma, activeOrgId);
    return NextResponse.json(defaults);
  } catch (e) {
    console.error("[quote-defaults GET]", e);
    return NextResponse.json({ error: "Failed to load quote defaults" }, { status: 500 });
  }
}

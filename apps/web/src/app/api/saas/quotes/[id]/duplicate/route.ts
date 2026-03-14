import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { duplicateQuote } from "@vbt/core";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireActiveOrg();
    const tenantCtx = {
      userId: user.userId ?? user.id,
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: user.isPlatformSuperadmin,
    };
    const quote = await duplicateQuote(prisma, tenantCtx, params.id);
    return NextResponse.json(quote, { status: 201 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Quote not found") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    throw e;
  }
}

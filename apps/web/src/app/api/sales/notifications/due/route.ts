import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getEffectiveOrganizationId, getEffectiveActiveOrgId } from "@/lib/tenant";
import { listDueInvoiceItems } from "@/lib/partner-sales";

/** Partner UI: count of invoices due within the next `days` (default 7). Superadmin: pass organizationId or use active-org cookie. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const url = new URL(req.url);

  let organizationId: string | null;
  if (!user.isPlatformSuperadmin) {
    organizationId = getEffectiveOrganizationId(user);
  } else {
    organizationId =
      url.searchParams.get("organizationId")?.trim() || (await getEffectiveActiveOrgId(user));
  }

  if (!organizationId) return NextResponse.json({ count: 0, invoices: [] });

  const days = Math.min(30, Math.max(1, parseInt(url.searchParams.get("days") ?? "7", 10) || 7));
  const { count, invoices } = await listDueInvoiceItems(organizationId, days);
  return NextResponse.json({ count, invoices });
}

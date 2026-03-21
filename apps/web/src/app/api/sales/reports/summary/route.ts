import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { requireSalesScopedOrganizationId } from "@/lib/sales-access";
import { salesSummaryForOrg } from "@/lib/partner-sales";

const emptySummary = {
  totalSales: 0,
  totalValue: 0,
  totalInvoiced: 0,
  totalPaid: 0,
  totalPending: 0,
  byStatus: {} as Record<string, number>,
  entitySummary: [] as unknown[],
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const url = new URL(req.url);

  if (!user.isPlatformSuperadmin) {
    const organizationId = getEffectiveOrganizationId(user);
    if (!organizationId) {
      return NextResponse.json(emptySummary);
    }
    const summary = await salesSummaryForOrg(organizationId);
    return NextResponse.json(summary);
  }

  const scoped = await requireSalesScopedOrganizationId(user, url);
  if (!scoped.ok) {
    return NextResponse.json(emptySummary);
  }
  const summary = await salesSummaryForOrg(scoped.organizationId);
  return NextResponse.json(summary);
}

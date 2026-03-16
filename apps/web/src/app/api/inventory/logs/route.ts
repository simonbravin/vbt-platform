import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** @deprecated Use GET /api/saas/inventory/transactions instead. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    { error: "Deprecated. Use /api/saas/inventory/transactions." },
    { status: 410 }
  );
}

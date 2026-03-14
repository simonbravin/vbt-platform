import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Pieces report: stubbed, not used by main reports flow.
 * Returns empty aggregates. See docs/MODULE-MIGRATION-STATUS.md.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    byQty: [],
    byKg: [],
    byM2: [],
  });
}

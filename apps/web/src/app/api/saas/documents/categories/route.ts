import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { listDocumentCategories } from "@vbt/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const categories = await listDocumentCategories(prisma);
    return NextResponse.json(categories);
  } catch (e) {
    console.error("GET /api/saas/documents/categories error:", e);
    return NextResponse.json([]);
  }
}

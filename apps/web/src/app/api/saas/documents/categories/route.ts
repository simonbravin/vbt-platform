import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listDocumentCategories } from "@vbt/core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await listDocumentCategories(prisma);
    return NextResponse.json(categories);
  } catch (e) {
    console.error("GET /api/saas/documents/categories error:", e);
    return NextResponse.json([]);
  }
}

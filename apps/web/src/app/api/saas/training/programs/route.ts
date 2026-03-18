import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { listTrainingPrograms } from "@vbt/core";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const programs = await listTrainingPrograms(prisma, {
      status: url.searchParams.get("status") ?? undefined,
    });
    return NextResponse.json(programs);
  } catch (e) {
    console.error("GET /api/saas/training/programs error:", e);
    return NextResponse.json([]);
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { listQuizAttemptsAdmin } from "@vbt/core";

export async function GET(req: Request) {
  await requirePlatformSuperadmin();
  const url = new URL(req.url);
  const result = await listQuizAttemptsAdmin(prisma, {
    quizDefinitionId: url.searchParams.get("quizDefinitionId") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    limit: Number(url.searchParams.get("limit")) || 100,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

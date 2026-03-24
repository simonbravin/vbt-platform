import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { updateQuizQuestion } from "@vbt/core";
import { updateQuizQuestionSchema } from "@vbt/core/validation";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateQuizQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const q = await updateQuizQuestion(prisma, params.id, parsed.data);
    return NextResponse.json(q);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Not found";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

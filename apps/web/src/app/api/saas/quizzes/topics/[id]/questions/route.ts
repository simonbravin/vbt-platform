import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { listQuizQuestionsForTopic, createQuizQuestion } from "@vbt/core";
import { createQuizQuestionSchema } from "@vbt/core/validation";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const questions = await listQuizQuestionsForTopic(prisma, params.id);
  return NextResponse.json(questions);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createQuizQuestionSchema.safeParse({ ...body, topicId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const q = await createQuizQuestion(prisma, parsed.data);
    return NextResponse.json(q, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

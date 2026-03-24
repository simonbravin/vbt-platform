import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { listQuizQuestionsForTopic, createQuizQuestion, bulkUpdateQuizQuestionStatusForTopic } from "@vbt/core";
import { bulkQuizTopicQuestionStatusSchema, createQuizQuestionSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getHandler(_req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  await requirePlatformSuperadmin();
  const questions = await listQuizQuestionsForTopic(prisma, id);
  return NextResponse.json(questions);
}

async function postHandler(req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createQuizQuestionSchema.safeParse({ ...body, topicId: id });
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

async function patchHandler(req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id: topicId } = params instanceof Promise ? await params : params;
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = bulkQuizTopicQuestionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const { updated } = await bulkUpdateQuizQuestionStatusForTopic(
    prisma,
    topicId,
    parsed.data.status,
    parsed.data.questionIds
  );
  return NextResponse.json({ updated });
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
export const POST = withSaaSHandler({ rateLimitTier: "create_update" }, postHandler);
export const PATCH = withSaaSHandler({ rateLimitTier: "create_update" }, patchHandler);

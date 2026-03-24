import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { listQuizTopics, createQuizTopic } from "@vbt/core";
import { createQuizTopicSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(_req: Request) {
  await requirePlatformSuperadmin();
  const topics = await listQuizTopics(prisma);
  return NextResponse.json(topics);
}

async function postHandler(req: Request) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createQuizTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const topic = await createQuizTopic(prisma, parsed.data);
  return NextResponse.json(topic, { status: 201 });
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
export const POST = withSaaSHandler({ rateLimitTier: "create_update" }, postHandler);

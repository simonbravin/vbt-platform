import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { listQuizTopics, createQuizTopic } from "@vbt/core";
import { createQuizTopicSchema } from "@vbt/core/validation";

export async function GET() {
  await requirePlatformSuperadmin();
  const topics = await listQuizTopics(prisma);
  return NextResponse.json(topics);
}

export async function POST(req: Request) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createQuizTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const topic = await createQuizTopic(prisma, parsed.data);
  return NextResponse.json(topic, { status: 201 });
}

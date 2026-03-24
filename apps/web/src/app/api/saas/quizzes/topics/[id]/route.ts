import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { updateQuizTopic } from "@vbt/core";
import { updateQuizTopicSchema } from "@vbt/core/validation";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateQuizTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const topic = await updateQuizTopic(prisma, params.id, parsed.data);
    return NextResponse.json(topic);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { updateQuizTopic } from "@vbt/core";
import { updateQuizTopicSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function patchHandler(req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateQuizTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const topic = await updateQuizTopic(prisma, id, parsed.data);
    return NextResponse.json(topic);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export const PATCH = withSaaSHandler({ rateLimitTier: "create_update" }, patchHandler);

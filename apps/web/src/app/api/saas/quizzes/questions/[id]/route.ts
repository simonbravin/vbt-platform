import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { updateQuizQuestion } from "@vbt/core";
import { updateQuizQuestionSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function patchHandler(req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateQuizQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const q = await updateQuizQuestion(prisma, id, parsed.data);
    return NextResponse.json(q);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Not found";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const PATCH = withSaaSHandler({ rateLimitTier: "create_update" }, patchHandler);

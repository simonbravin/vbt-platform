import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";

const bodySchema = z.object({
  locale: z.enum(["en", "es"]),
});

/** Persist authenticated user's preferred locale for transactional email subjects. */
export async function POST(req: Request) {
  try {
    const sessionUser = await requireSession();
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: sessionUser.userId ?? sessionUser.id },
      data: { emailLocale: parsed.data.locale },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

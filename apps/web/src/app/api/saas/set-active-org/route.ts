import { NextResponse } from "next/server";
import { requirePlatformSuperadmin, ACTIVE_ORG_COOKIE } from "@/lib/tenant";
import { TenantError, tenantErrorStatus } from "@/lib/tenant";
import { z } from "zod";

const bodySchema = z.object({
  organizationId: z.string().uuid().nullable(),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  try {
    await requirePlatformSuperadmin();
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { organizationId } = parsed.data;
    const res = NextResponse.json({ ok: true });
    if (organizationId) {
      res.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    } else {
      res.cookies.set(ACTIVE_ORG_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
    }
    return res;
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

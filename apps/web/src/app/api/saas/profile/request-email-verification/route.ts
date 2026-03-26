import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { checkRateLimit, getRateLimitIdentifier, RateLimitExceededError } from "@/lib/rate-limit";
import { createEmailVerificationTokenAndSend } from "@/lib/send-email-verification";

export async function POST(req: Request) {
  try {
    await checkRateLimit(getRateLimitIdentifier(req), "auth");
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }

  try {
    const sessionUser = await requireSession();
    const userId = sessionUser.userId ?? sessionUser.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, emailLocale: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    const result = await createEmailVerificationTokenAndSend(userId, user.email, user.emailLocale);
    if (!result.ok) {
      if (result.reason === "no_resend") {
        return NextResponse.json(
          { error: "Email delivery is not configured. Contact support." },
          { status: 503 }
        );
      }
      if (result.reason === "token_store_unavailable") {
        return NextResponse.json(
          { error: "Verification token storage unavailable. Ensure latest DB migration is deployed." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Could not send verification email. Try again later." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[request-email-verification]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

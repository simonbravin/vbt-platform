import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { buildForgotPasswordEmailHtml } from "@/lib/email-bodies";
import { getResendFrom, emailSubjectPasswordReset, parseEmailLocale, type EmailLocale } from "@/lib/email-config";
import { z } from "zod";
import crypto from "crypto";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { checkRateLimit, getRateLimitIdentifier, RateLimitExceededError } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email("Invalid email address"),
  locale: z.enum(["en", "es"]).optional(),
});

const TOKEN_EXPIRY_HOURS = 1;

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
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { email, locale: requestedLocale } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, emailLocale: true },
    });
    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ ok: true, message: "If that email exists, we sent a reset link." });
    }

    if (requestedLocale === "es" || requestedLocale === "en") {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailLocale: requestedLocale },
        });
      } catch {
        // ignore if column missing before migration
      }
    }

    const mailLocale: EmailLocale =
      requestedLocale === "es" || requestedLocale === "en"
        ? requestedLocale
        : parseEmailLocale(user.emailLocale);

    let token: string;
    let usedDbToken = false;

    // Prefer DB token when table exists; fallback to signed JWT so reset works without migrations
    try {
      const randomToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: {
          token: randomToken,
          userId: user.id,
          expiresAt,
        },
      });
      token = randomToken;
      usedDbToken = true;
    } catch {
      // Table missing or other DB error: use signed token (no DB table required)
      try {
        token = createPasswordResetToken(user.id, user.email);
      } catch (e) {
        console.error("Password reset token creation failed (missing NEXTAUTH_SECRET?)", e);
        return NextResponse.json(
          { error: "Password reset is temporarily unavailable. Contact support." },
          { status: 503 }
        );
      }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = buildForgotPasswordEmailHtml(mailLocale, {
          resetUrl,
          hours: TOKEN_EXPIRY_HOURS,
        });
        await resend.emails.send({
          from: getResendFrom(),
          to: user.email,
          subject: emailSubjectPasswordReset(mailLocale),
          html,
        });
      } catch (emailErr) {
        console.warn("Failed to send password reset email:", emailErr);
        if (usedDbToken) {
          try {
            await prisma.passwordResetToken.deleteMany({ where: { token } });
          } catch {
            // ignore
          }
        }
        return NextResponse.json(
          { error: "Failed to send email. Try again later or contact support." },
          { status: 503 }
        );
      }
    } else {
      if (usedDbToken) {
        try {
          await prisma.passwordResetToken.deleteMany({ where: { token } });
        } catch {
          // ignore
        }
      }
      return NextResponse.json(
        { error: "Password reset emails are not configured. Contact an administrator." },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, message: "If that email exists, we sent a reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

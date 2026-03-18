import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { buildVbtEmailHtml, escapeHtml, VBT_EMAIL } from "@/lib/email-templates";
import { getResendFrom, EMAIL_SUBJECTS } from "@/lib/email-config";
import { z } from "zod";
import crypto from "crypto";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { checkRateLimit, getRateLimitIdentifier, RateLimitExceededError } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email("Invalid email address"),
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
    const { email } = parsed.data;

    // Select only id and email so we don't require columns that may not exist in all DBs (e.g. full_name vs name)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true },
    });
    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ ok: true, message: "If that email exists, we sent a reset link." });
    }

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
        const html = buildVbtEmailHtml({
          title: "Reset your password",
          subtitle: "Vision Building Technologies",
          bodyHtml: `
            <p style="margin: 0 0 12px 0;">Hi,</p>
            <p style="margin: 0 0 16px 0;">You requested a password reset. Click the link below to set a new password. This link expires in ${TOKEN_EXPIRY_HOURS} hour(s).</p>
            <p style="margin: 0 0 16px 0;"><a href="${escapeHtml(resetUrl)}" style="color: ${VBT_EMAIL.accent}; font-weight: 600;">Reset password</a></p>
            <p style="margin: 0; color: #666; font-size: 13px;">If you didn't request this, you can ignore this email.</p>
          `.trim(),
          footerText: "This notification was sent by the VBT Cotizador.",
        });
        await resend.emails.send({
          from: getResendFrom(),
          to: user.email,
          subject: EMAIL_SUBJECTS.passwordReset,
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

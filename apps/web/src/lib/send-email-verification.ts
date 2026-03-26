import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { buildEmailVerificationHtml } from "@/lib/email-bodies";
import { getResendFrom, emailSubjectEmailVerification, parseEmailLocale } from "@/lib/email-config";

const EXPIRY_HOURS = 24;

export type SendEmailVerificationResult =
  | { ok: true }
  | { ok: false; reason: "no_resend" | "send_failed" | "token_store_unavailable" };

/** Creates a fresh token (invalidates previous rows for this user) and sends the message via Resend. */
export async function createEmailVerificationTokenAndSend(
  userId: string,
  email: string,
  emailLocaleRaw: unknown
): Promise<SendEmailVerificationResult> {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return { ok: false, reason: "no_resend" };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  try {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.emailVerificationToken.create({
      data: { token, userId, expiresAt },
    });
  } catch (e) {
    console.error("[send-email-verification token store]", e);
    return { ok: false, reason: "token_store_unavailable" };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const locale = parseEmailLocale(emailLocaleRaw);
  const html = buildEmailVerificationHtml(locale, { verifyUrl, hours: EXPIRY_HOURS });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: getResendFrom(),
      to: email,
      subject: emailSubjectEmailVerification(locale),
      html,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[send-email-verification]", e);
    return { ok: false, reason: "send_failed" };
  }
}

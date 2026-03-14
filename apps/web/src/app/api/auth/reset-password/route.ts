import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { verifyPasswordResetToken } from "@/lib/password-reset-token";

const bodySchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

/** True if token looks like a DB token (64-char hex), not a signed JWT-style token */
function isDbToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;

    // 1) If token looks like DB token, try password_reset_tokens table (may not exist)
    if (isDbToken(token)) {
      try {
        const resetRecord = await prisma.passwordResetToken.findUnique({
          where: { token },
          select: { id: true, userId: true, usedAt: true, expiresAt: true },
        });

        if (resetRecord) {
          if (resetRecord.usedAt) {
            return NextResponse.json({ error: "This reset link was already used. Request a new one." }, { status: 400 });
          }
          if (new Date() > resetRecord.expiresAt) {
            await prisma.passwordResetToken.update({
              where: { id: resetRecord.id },
              data: { usedAt: new Date() },
            });
            return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 400 });
          }

          const passwordHash = await bcrypt.hash(password, 12);
          await prisma.$transaction([
            prisma.user.updateMany({
              where: { id: resetRecord.userId },
              data: { passwordHash },
            }),
            prisma.passwordResetToken.update({
              where: { id: resetRecord.id },
              data: { usedAt: new Date() },
            }),
          ]);
          return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
        }
      } catch {
        // Table missing or query error; fall through to signed token
      }
    }

    // 2) Signed token (no DB table required)
    const payload = verifyPasswordResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.updateMany({
      where: { id: payload.userId },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

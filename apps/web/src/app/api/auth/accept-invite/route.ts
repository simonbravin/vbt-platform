import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { API_ROLE_TO_ORG } from "@vbt/core";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string().min(1, "Invalid token"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const { token, fullName, password } = parsed.data;
    const invite = await prisma.partnerInvite.findFirst({
      where: {
        token: token.trim(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invitation. Please request a new one." },
        { status: 400 }
      );
    }

    const emailNorm = invite.email.toLowerCase();
    let user = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
      select: { id: true },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 12);
      user = await prisma.user.create({
        data: {
          email: emailNorm,
          fullName: fullName.trim(),
          passwordHash,
          isActive: true,
        },
      });
    }
    // If user already exists (e.g. signed up meanwhile), add them to the org instead of failing

    const orgRole = API_ROLE_TO_ORG[invite.role] ?? "viewer";
    await prisma.orgMember.upsert({
      where: {
        organizationId_userId: { organizationId: invite.organizationId, userId: user.id },
      },
      create: {
        organizationId: invite.organizationId,
        userId: user.id,
        role: orgRole,
        status: "active",
      },
      update: { role: orgRole, status: "active" },
    });

    await prisma.partnerInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "Account created. You can sign in now.",
    });
  } catch (e) {
    console.error("[accept-invite]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

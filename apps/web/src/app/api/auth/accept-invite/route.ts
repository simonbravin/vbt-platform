import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { API_ROLE_TO_ORG } from "@vbt/core";
import { z } from "zod";
import crypto from "crypto";

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
    const orgRole = API_ROLE_TO_ORG[invite.role] ?? "viewer";
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1) Claim invite (usedAt) so double-submit or race returns clear error; rollback if later steps fail
      const claimed = await tx.partnerInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count === 0) {
        throw new Error("INVITE_ALREADY_USED");
      }

      // 2) Get or create user
      let user = await tx.user.findFirst({
        where: { email: { equals: emailNorm, mode: "insensitive" } },
        select: { id: true },
      });
      if (!user) {
        const passwordHash = await bcrypt.hash(password, 12);
        const id = crypto.randomUUID();
        const nowIso = now.toISOString();
        // Solución definitiva: INSERT explícito con cast ::timestamp. Prisma create() no envía @updatedAt
        // de forma fiable; la migración 20250318000000 normaliza la tabla y pone DEFAULT. Aquí enviamos
        // ISO string y casteamos en SQL para que funcione igual en todos los entornos (driver envía text).
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO users (id, full_name, email, password_hash, is_active, is_platform_superadmin, created_at, updated_at)
            VALUES (${id}, ${fullName.trim()}, ${emailNorm}, ${passwordHash}, true, false, ${nowIso}::timestamp, ${nowIso}::timestamp)
          `
        );
        user = { id };
      }

      // 3) Upsert org member (idempotent if user already in org)
      await tx.orgMember.upsert({
        where: {
          organizationId_userId: { organizationId: invite.organizationId, userId: user.id },
        },
        create: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: orgRole,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        update: { role: orgRole, status: "active", updatedAt: now },
      });

    });

    return NextResponse.json({
      success: true,
      message: "Account created. You can sign in now.",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw === "INVITE_ALREADY_USED") {
      return NextResponse.json(
        { error: "This invitation was already used. Please sign in or request a new invitation." },
        { status: 400 }
      );
    }
    console.error("[accept-invite]", e);
    const safeMessage = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
    return NextResponse.json(
      { error: "Something went wrong", debug: safeMessage },
      { status: 500 }
    );
  }
}

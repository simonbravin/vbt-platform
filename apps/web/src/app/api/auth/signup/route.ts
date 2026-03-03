import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Resend } from "resend";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Find the default org
    const org = await prisma.org.findFirst({ where: { slug: "vision-latam" } });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        status: "PENDING",
      },
    });

    // Add as PENDING member of org (no active role yet)
    if (org) {
      await prisma.orgMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: "VIEWER",
        },
      });
    }

    // Notify superadmin by email if Resend is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "noreply@visionlatam.com",
          to: process.env.SUPERADMIN_EMAIL ?? "simon@visionlatam.com",
          subject: "New VBT Cotizador account request",
          html: `
            <h2>New Account Request</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/users">Review in Admin Panel</a></p>
          `,
        });
      } catch (emailErr) {
        console.warn("Failed to send notification email:", emailErr);
      }
    }

    return NextResponse.json({ id: user.id, status: "PENDING" }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Resend } from "resend";
import { buildSignupRequestAdminEmailHtml } from "@/lib/email-bodies";
import { getResendFrom, emailSubjectSignupRequest, parseEmailLocale } from "@/lib/email-config";
import { checkRateLimit, getRateLimitIdentifier, RateLimitExceededError } from "@/lib/rate-limit";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  /** UI locale — stored as preferred language for future emails */
  locale: z.enum(["en", "es"]).optional(),
});

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
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, locale: signupLocale } = parsed.data;

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Find the default org (Vision Latam – seed creates with name "Vision Latam")
    const org = await prisma.organization.findFirst({
      where: { name: "Vision Latam" },
    });

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        passwordHash,
        isActive: false, // pending approval
        emailLocale: parseEmailLocale(signupLocale),
      },
    });

    // Add as invited member of org until approved
    if (org) {
      await prisma.orgMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "viewer",
          status: "invited",
        },
      });
    }

    // Notify superadmin by email if Resend is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const adminUsersUrl = `${appUrl.replace(/\/$/, "")}/superadmin/admin/users`;
        const superadminEmail = process.env.SUPERADMIN_EMAIL ?? "admin@visionbuildingtechs.com";
        const superadminUser = await prisma.user.findFirst({
          where: { email: { equals: superadminEmail, mode: "insensitive" } },
          select: { emailLocale: true },
        });
        const adminLocale = parseEmailLocale(superadminUser?.emailLocale);
        const html = buildSignupRequestAdminEmailHtml(adminLocale, {
          applicantName: name,
          applicantEmail: email,
          adminUsersUrl,
        });
        await resend.emails.send({
          from: getResendFrom(),
          to: superadminEmail,
          subject: emailSubjectSignupRequest(adminLocale),
          html,
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

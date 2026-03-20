import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { inviteOrgMember, ORG_ROLE_TO_API } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { buildPartnerInviteEmailHtml, buildPartnerInviteNewUserEmailHtml } from "@/lib/email-bodies";
import {
  getResendFrom,
  emailSubjectPartnerInviteExisting,
  emailSubjectPartnerInviteNewUser,
  parseEmailLocale,
} from "@/lib/email-config";
import { Resend } from "resend";
import { z } from "zod";
import { randomBytes } from "crypto";

const ROLES = ["owner", "admin", "sales", "engineer", "viewer"] as const;
const INVITE_EXPIRY_DAYS = 7;

const postSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(ROLES),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await getTenantContext();
    if (!tenantCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requirePlatformSuperadmin();

    const inviter = await prisma.user.findUnique({
      where: { id: tenantCtx.userId },
      select: { emailLocale: true },
    });
    const inviterLocale = parseEmailLocale(inviter?.emailLocale);

    const partner = await prisma.organization.findFirst({
      where: {
        id: params.id,
        organizationType: { in: ["commercial_partner", "master_partner"] },
      },
      select: { id: true, name: true },
    });
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const emailNorm = parsed.data.email.trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
      select: { id: true, emailLocale: true },
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const roleLabel = parsed.data.role.charAt(0).toUpperCase() + parsed.data.role.slice(1);

    if (existingUser) {
      const inviteCtx = {
        userId: tenantCtx.userId,
        organizationId: null,
        isPlatformSuperadmin: true,
      };
      const member = await inviteOrgMember(prisma, inviteCtx, {
        userId: existingUser.id,
        role: parsed.data.role,
        organizationId: partner.id,
      });

      await createActivityLog({
        organizationId: partner.id,
        userId: tenantCtx.userId,
        action: "member_invited",
        entityType: "org_member",
        entityId: member.id,
        metadata: { email: parsed.data.email, role: parsed.data.role },
      });

      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const html = buildPartnerInviteEmailHtml(parseEmailLocale(existingUser.emailLocale), {
            partnerName: partner.name,
            inviteeEmail: parsed.data.email,
            role: roleLabel,
            appUrl,
          });
          await resend.emails.send({
            from: getResendFrom(),
            to: parsed.data.email,
            subject: emailSubjectPartnerInviteExisting(
              parseEmailLocale(existingUser.emailLocale),
              partner.name
            ),
            html,
          });
        } catch (emailErr) {
          console.warn("Partner invite email failed:", emailErr);
        }
      }

      return NextResponse.json(
        { ...member, role: ORG_ROLE_TO_API[member.role] ?? member.role },
        { status: 201 }
      );
    }

    // User doesn't exist: create pending invite and send "create your account" email
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    await prisma.partnerInvite.create({
      data: {
        email: emailNorm,
        organizationId: partner.id,
        role: parsed.data.role,
        token,
        expiresAt,
      },
    });

    await createActivityLog({
      organizationId: partner.id,
      userId: tenantCtx.userId,
      action: "partner_invite_sent",
      entityType: "partner_invite",
      entityId: partner.id,
      metadata: { email: parsed.data.email, role: parsed.data.role },
    });

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(token)}`;
        const html = buildPartnerInviteNewUserEmailHtml(inviterLocale, {
          partnerName: partner.name,
          inviteeEmail: parsed.data.email,
          role: roleLabel,
          acceptUrl,
        });
        await resend.emails.send({
          from: getResendFrom(),
          to: parsed.data.email,
          subject: emailSubjectPartnerInviteNewUser(inviterLocale, partner.name),
          html,
        });
      } catch (emailErr) {
        console.warn("Partner invite (new user) email failed:", emailErr);
      }
    }

    return NextResponse.json(
      { pendingInvite: true, email: parsed.data.email, message: "Invitation sent. They will receive an email to create their account." },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    if (e instanceof Error && e.message === "Organization required") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}

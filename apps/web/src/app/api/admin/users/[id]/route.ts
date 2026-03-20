import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { z } from "zod";
import { createActivityLog } from "@/lib/audit";
import {
  getResendFrom,
  emailSubjectAccountApproved,
  emailSubjectAccountRejected,
  parseEmailLocale,
} from "@/lib/email-config";
import { buildAccountStatusEmailHtml } from "@/lib/email-bodies";
import { Resend } from "resend";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "REJECTED", "SUSPENDED"]).optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "SALES", "VIEWER"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const found = await prisma.user.findUnique({
    where: { id: params.id },
    include: { orgMembers: { include: { organization: true } } },
  });

  if (!found) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(found);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentUser = session.user as any;
  const canUpdate = currentUser.role === "SUPERADMIN" || currentUser.isPlatformSuperadmin === true;
  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { status, role } = parsed.data;
  const orgId = getEffectiveOrganizationId(currentUser);

  // Fetch user before update to get their email and org membership (for role update when approver has no org)
  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    include: { orgMembers: { take: 1, select: { organizationId: true } } },
  });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const targetUserWithOrgs = targetUser as typeof targetUser & { orgMembers?: { organizationId: string }[] };
  const targetOrgId = orgId ?? targetUserWithOrgs.orgMembers?.[0]?.organizationId;

  const userData: { isActive?: boolean } = {};
  if (status === "ACTIVE") userData.isActive = true;
  if (status === "REJECTED" || status === "SUSPENDED") userData.isActive = false;

  const updated = Object.keys(userData).length
    ? await prisma.user.update({
        where: { id: params.id },
        data: userData,
      })
    : targetUser;

  const orgRoleMap: Record<string, "org_admin" | "viewer" | "sales_user" | "technical_user"> = {
    SUPERADMIN: "org_admin",
    ADMIN: "org_admin",
    SALES: "sales_user",
    VIEWER: "viewer",
  };
  if (role && targetOrgId && orgRoleMap[role]) {
    await prisma.orgMember.updateMany({
      where: { userId: params.id, organizationId: targetOrgId },
      data: { role: orgRoleMap[role] },
    });
  }

  const action = status === "ACTIVE"
    ? "USER_APPROVED"
    : status === "REJECTED" || status === "SUSPENDED"
      ? "USER_REJECTED"
      : role
        ? "USER_ROLE_CHANGED"
        : null;
  if (action && (orgId ?? targetOrgId)) {
    await createActivityLog({
      organizationId: orgId ?? targetOrgId ?? undefined,
      userId: currentUser.id,
      action: action as string,
      entityType: "User",
      entityId: params.id,
      metadata: { status, role },
    });
  }

  // Send email notification to the user
  if (process.env.RESEND_API_KEY && (status === "ACTIVE" || status === "REJECTED")) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.visionlatam.com";
      const approved = status === "ACTIVE";
      const mailLocale = parseEmailLocale(targetUser.emailLocale);
      const recipientGreeting = targetUser.fullName ?? targetUser.email;
      const supportEmail =
        process.env.SUPERADMIN_EMAIL ?? "admin@visionbuildingtechs.com";

      await resend.emails.send({
        from: getResendFrom(),
        to: targetUser.email,
        subject: approved
          ? emailSubjectAccountApproved(mailLocale)
          : emailSubjectAccountRejected(mailLocale),
        html: buildAccountStatusEmailHtml(mailLocale, {
          approved,
          appUrl,
          recipientGreeting,
          supportEmail,
        }),
      });
    } catch (emailErr) {
      console.warn("Failed to send user notification email:", emailErr);
    }
  }

  return NextResponse.json(updated);
}

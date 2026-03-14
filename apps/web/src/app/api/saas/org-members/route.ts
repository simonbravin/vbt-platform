import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { listOrgMembers, inviteOrgMember, ORG_ROLE_TO_API } from "@vbt/core";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const ROLES = ["owner", "admin", "sales", "engineer", "viewer"] as const;

const postSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES),
  organizationId: z.string().uuid().optional(),
}).refine((data) => data.userId ?? data.email, { message: "Provide userId or email" });

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }
    const url = new URL(req.url);
    const organizationIdParam = url.searchParams.get("organizationId");
    const tenantCtx = {
      userId: ctx.userId,
      organizationId: ctx.activeOrgId ?? null,
      isPlatformSuperadmin: ctx.isPlatformSuperadmin ?? false,
    };
    const result = await listOrgMembers(prisma, tenantCtx, {
      status: url.searchParams.get("status") as "active" | "inactive" | "invited" | "suspended" | undefined,
      limit: Number(url.searchParams.get("limit")) || 50,
      offset: Number(url.searchParams.get("offset")) || 0,
      ...(ctx.isPlatformSuperadmin && organizationIdParam ? { organizationId: organizationIdParam } : {}),
    });
    const members = result.members.map((m) => ({
      ...m,
      role: ORG_ROLE_TO_API[m.role] ?? m.role,
    }));
    return NextResponse.json({ members, total: result.total });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await getTenantContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSuperadmin = user.isPlatformSuperadmin === true;
    if (!user.activeOrgId && !isSuperadmin) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }
    if (!isSuperadmin && user.role !== "org_admin") {
      return NextResponse.json({ error: "Only organization owners or admins can invite members" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    if (parsed.data.organizationId && !isSuperadmin) {
      return NextResponse.json({ error: "Only platform superadmin can specify organizationId" }, { status: 403 });
    }
    let targetUserId = parsed.data.userId;
    if (!targetUserId && parsed.data.email) {
      const emailNorm = parsed.data.email.trim().toLowerCase();
      const found = await prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: "insensitive" } },
        select: { id: true },
      });
      if (!found) {
        return NextResponse.json(
          { error: "No user with this email. They must sign up first." },
          { status: 404 }
        );
      }
      targetUserId = found.id;
    }
    if (!targetUserId) {
      return NextResponse.json({ error: "Provide userId or email" }, { status: 400 });
    }
    const tenantCtx = {
      userId: user.userId ?? "",
      organizationId: user.activeOrgId ?? null,
      isPlatformSuperadmin: isSuperadmin,
    };
    const member = await inviteOrgMember(prisma, tenantCtx, {
      userId: targetUserId,
      role: parsed.data.role,
      ...(isSuperadmin && parsed.data.organizationId ? { organizationId: parsed.data.organizationId } : {}),
    });
    const targetOrgId = parsed.data.organizationId ?? user.activeOrgId ?? null;
    await createActivityLog({
      organizationId: targetOrgId,
      userId: user.userId,
      action: "member_invited",
      entityType: "org_member",
      entityId: member.id,
      metadata: { userId: targetUserId, role: parsed.data.role },
    });
    return NextResponse.json(
      { ...member, role: ORG_ROLE_TO_API[member.role as keyof typeof ORG_ROLE_TO_API] ?? member.role },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    throw e;
  }
}

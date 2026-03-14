import type { PrismaClient, OrgMemberRole } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

/** API role names mapped to OrgMemberRole */
export const API_ROLE_TO_ORG: Record<string, OrgMemberRole> = {
  owner: "org_admin",
  admin: "org_admin",
  sales: "sales_user",
  engineer: "technical_user",
  viewer: "viewer",
};

export const ORG_ROLE_TO_API: Record<OrgMemberRole, string> = {
  org_admin: "admin",
  sales_user: "sales",
  technical_user: "engineer",
  viewer: "viewer",
};

export type ListOrgMembersOptions = {
  limit?: number;
  offset?: number;
  status?: "active" | "inactive" | "invited" | "suspended";
  /** When caller is platform superadmin, scope to this organization (e.g. partner id). */
  organizationId?: string;
};

export async function listOrgMembers(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListOrgMembersOptions = {}
) {
  let orgWhere: { organizationId?: string } = orgScopeWhere(ctx);
  if (ctx.isPlatformSuperadmin && options.organizationId) {
    orgWhere = { organizationId: options.organizationId };
  }
  if (Object.keys(orgWhere).length === 0 && !ctx.isPlatformSuperadmin) {
    return { members: [], total: 0 };
  }
  const where = {
    ...orgWhere,
    ...(options.status && { status: options.status }),
  };
  const [members, total] = await Promise.all([
    prisma.orgMember.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        invitedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.orgMember.count({ where }),
  ]);
  return { members, total };
}

export type InviteOrgMemberInput = {
  userId: string;
  role: string; // owner | admin | sales | engineer | viewer
  /** When caller is platform superadmin, invite to this organization (e.g. partner id). */
  organizationId?: string;
};

export async function inviteOrgMember(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: InviteOrgMemberInput
) {
  let organizationId: string | undefined = input.organizationId ?? ctx.organizationId ?? undefined;
  if (ctx.isPlatformSuperadmin && input.organizationId) {
    organizationId = input.organizationId;
  }
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required to invite member");
  }
  if (!organizationId) throw new Error("Organization required");
  const role = API_ROLE_TO_ORG[input.role] ?? "viewer";
  const existing = await prisma.orgMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: input.userId },
    },
  });
  if (existing) {
    return prisma.orgMember.update({
      where: { id: existing.id },
      data: { role, status: "invited", invitedByUserId: ctx.userId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }
  return prisma.orgMember.create({
    data: {
      organizationId,
      userId: input.userId,
      role,
      status: "invited",
      invitedByUserId: ctx.userId,
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });
}

export type UpdateOrgMemberInput = {
  role?: string; // owner | admin | sales | engineer | viewer
  status?: "active" | "inactive" | "invited" | "suspended";
};

export async function updateOrgMember(
  prisma: PrismaClient,
  ctx: TenantContext,
  memberId: string,
  data: UpdateOrgMemberInput
) {
  const orgWhere = orgScopeWhere(ctx);
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, ...orgWhere },
    include: { user: true },
  });
  if (!member) throw new Error("Member not found");
  const updateData: { role?: OrgMemberRole; status?: "active" | "inactive" | "invited" | "suspended" } = {};
  if (data.role != null) updateData.role = API_ROLE_TO_ORG[data.role] ?? member.role;
  if (data.status != null) updateData.status = data.status;
  return prisma.orgMember.update({
    where: { id: memberId },
    data: updateData,
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function removeOrgMember(
  prisma: PrismaClient,
  ctx: TenantContext,
  memberId: string
) {
  const orgWhere = orgScopeWhere(ctx);
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, ...orgWhere },
  });
  if (!member) throw new Error("Member not found");
  await prisma.orgMember.delete({ where: { id: memberId } });
  return { id: memberId };
}

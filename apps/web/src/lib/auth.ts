import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@vbt/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { OrgMemberRole } from "@vbt/db";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            orgMembers: {
              where: { status: "active" },
              include: { organization: true },
              orderBy: { joinedAt: "asc" },
            },
          },
        });

        if (!user) return null;
        if (!user.isActive) {
          throw new Error("PENDING");
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Use first active membership as active org (multi-org: one active per session)
        const activeMembership = user.orgMembers[0];

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          activeOrgId: activeMembership?.organization.id ?? null,
          activeOrgName: activeMembership?.organization.name ?? null,
          role: (activeMembership?.role ?? "viewer") as string,
          isPlatformSuperadmin: user.isPlatformSuperadmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.activeOrgId = (user as any).activeOrgId;
        token.activeOrgName = (user as any).activeOrgName;
        token.role = (user as any).role;
        token.isPlatformSuperadmin = (user as any).isPlatformSuperadmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).userId = token.id;
        (session.user as any).activeOrgId = token.activeOrgId ?? null;
        (session.user as any).activeOrgName = token.activeOrgName ?? null;
        (session.user as any).role = token.role ?? "viewer";
        (session.user as any).roles = token.role ? [token.role] : [];
        (session.user as any).isPlatformSuperadmin = token.isPlatformSuperadmin ?? false;
        // Backward compat for existing UI that expects orgId
        (session.user as any).orgId = token.activeOrgId ?? null;
        (session.user as any).orgSlug = token.activeOrgName ?? null;
      }
      return session;
    },
  },
};

/**
 * Session user shape for Partner SaaS.
 * - userId: same as id (for clarity in tenant helpers).
 * - activeOrgId: organization scope for this session (null if no org membership).
 * - role: role in the active organization (org_admin | sales_user | technical_user | viewer).
 * - roles: array with the active org role (for compatibility; one active org per session).
 * - isPlatformSuperadmin: can access all tenants and manage permissions.
 */
export type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name?: string | null;
  activeOrgId: string | null;
  activeOrgName?: string | null;
  role: OrgMemberRole | string;
  roles: string[];
  isPlatformSuperadmin: boolean;
  /** @deprecated Use activeOrgId */
  orgId?: string | null;
  /** @deprecated Use activeOrgName */
  orgSlug?: string | null;
};

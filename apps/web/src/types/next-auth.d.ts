import type { OrgMemberRole } from "@vbt/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userId: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      activeOrgId: string | null;
      activeOrgName?: string | null;
      role: OrgMemberRole | string;
      roles: string[];
      isPlatformSuperadmin: boolean;
      /** @deprecated Use activeOrgId. Only for backward compat; login populates activeOrgId. */
      orgId: string | null;
      /** @deprecated Use activeOrgName */
      orgSlug?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    activeOrgId?: string | null;
    activeOrgName?: string | null;
    role?: string;
    isPlatformSuperadmin?: boolean;
  }
}

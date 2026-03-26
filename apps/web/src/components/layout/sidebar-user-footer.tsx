"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const ROLE_BADGE_FALLBACK = "bg-header-foreground/20 text-header-foreground";
const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-header-foreground/20 text-header-foreground",
  org_admin: "bg-header-foreground/20 text-header-foreground",
  sales_user: "bg-header-foreground/20 text-header-foreground",
  technical_user: "bg-header-foreground/20 text-header-foreground",
  viewer: "bg-header-foreground/20 text-header-foreground",
};

export function SidebarUserFooter({
  displayName,
  role,
  profileHref,
  hasAvatar,
}: {
  displayName: string;
  role: string;
  profileHref: string;
  hasAvatar?: boolean;
}) {
  const t = useT();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const roleLabel = role.replaceAll("_", " ").toUpperCase();

  return (
    <div className="px-3 py-2.5 border-t border-header-foreground/10">
      <div className="flex items-start gap-2.5">
        <Link
          href={profileHref}
          className="relative h-9 w-9 shrink-0 rounded-full bg-header-foreground/15 overflow-hidden flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35"
          title={t("nav.settings.profile")}
        >
          {hasAvatar && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/saas/profile/avatar"
              alt=""
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <User className="h-4 w-4 text-header-foreground/80" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={profileHref}
            className="block text-left text-xs text-header-foreground/90 font-medium truncate hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35 rounded-sm"
            title={displayName}
          >
            {displayName}
          </Link>
          <span
            className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wide ${ROLE_COLORS[role] ?? ROLE_BADGE_FALLBACK}`}
          >
            {roleLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="shrink-0 p-1.5 text-header-foreground/70 hover:text-header-foreground rounded-sm hover:bg-header-foreground/10 transition-colors"
          title={t("topbar.signOut")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

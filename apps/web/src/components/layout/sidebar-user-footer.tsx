"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

/** Legacy chrome: translucent pill on dark rail (same in header and shadcn sidebar). */
const ROLE_BADGE_FALLBACK = "bg-header-foreground/20 text-header-foreground/90";
const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-header-foreground/20 text-header-foreground/90",
  org_admin: "bg-header-foreground/20 text-header-foreground/90",
  sales_user: "bg-header-foreground/20 text-header-foreground/90",
  technical_user: "bg-header-foreground/20 text-header-foreground/90",
  viewer: "bg-header-foreground/20 text-header-foreground/90",
};

export function SidebarUserFooter({
  displayName,
  role,
  profileHref,
  hasAvatar,
  surface = "header",
}: {
  displayName: string;
  role: string;
  profileHref: string;
  hasAvatar?: boolean;
  surface?: "header" | "sidebar";
}) {
  const t = useT();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const roleLabel = role.replaceAll("_", " ").toUpperCase();
  const isSidebar = surface === "sidebar";
  const roleBadgeClass = ROLE_COLORS[role] ?? ROLE_BADGE_FALLBACK;

  return (
    <div
      className={cn(
        "px-2 py-3",
        isSidebar ? "border-sidebar-border text-sidebar-foreground" : "border-t border-header-foreground/10"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Link
          href={profileHref}
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-header-foreground/15 outline-none focus-visible:ring-2",
            isSidebar ? "focus-visible:ring-sidebar-ring" : "focus-visible:ring-header-foreground/35"
          )}
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
            <User className={cn("h-4 w-4", isSidebar ? "text-sidebar-foreground/80" : "text-header-foreground/80")} />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={profileHref}
            className={cn(
              "block truncate text-left font-medium hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2",
              isSidebar
                ? "text-[13px] leading-snug tracking-[-0.02em] text-sidebar-foreground/88 focus-visible:ring-sidebar-ring"
                : "text-caption tracking-[-0.02em] text-header-foreground/90 focus-visible:ring-header-foreground/35"
            )}
            title={displayName}
          >
            {displayName}
          </Link>
          <span
            className={cn(
              "mt-0.5 inline-block rounded-md font-medium uppercase tracking-wide",
              isSidebar ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-micro",
              roleBadgeClass
            )}
          >
            {roleLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "shrink-0 rounded-lg p-1.5 transition-colors",
            isSidebar
              ? "text-sidebar-foreground/70 hover:bg-header-foreground/10 hover:text-header-foreground"
              : "text-header-foreground/70 hover:bg-header-foreground/10 hover:text-header-foreground"
          )}
          title={t("topbar.signOut")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

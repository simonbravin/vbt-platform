"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { User, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Legacy chrome: translucent pill on dark rail (same in header and shadcn sidebar). */
const ROLE_BADGE_FALLBACK = "bg-header-foreground/20 text-header-foreground/90";
const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-header-foreground/20 text-header-foreground/90",
  org_admin: "bg-header-foreground/20 text-header-foreground/90",
  sales_user: "bg-header-foreground/20 text-header-foreground/90",
  technical_user: "bg-header-foreground/20 text-header-foreground/90",
  viewer: "bg-header-foreground/20 text-header-foreground/90",
};

type FooterBaseProps = {
  displayName: string;
  role: string;
  profileHref: string;
  hasAvatar?: boolean;
  versionLabel?: string | null;
  settingsHref?: string;
};

export function SidebarUserFooter({
  displayName,
  role,
  profileHref,
  hasAvatar,
  surface = "header",
  versionLabel,
  settingsHref = "/settings",
}: FooterBaseProps & {
  surface?: "header" | "sidebar";
}) {
  if (surface === "header") {
    return (
      <SidebarUserFooterHeaderChrome
        displayName={displayName}
        role={role}
        profileHref={profileHref}
        hasAvatar={hasAvatar}
      />
    );
  }
  return (
    <SidebarUserFooterSidebarChrome
      displayName={displayName}
      role={role}
      profileHref={profileHref}
      hasAvatar={hasAvatar}
      versionLabel={versionLabel}
      settingsHref={settingsHref}
    />
  );
}

function SidebarUserFooterHeaderChrome({
  displayName,
  role,
  profileHref,
  hasAvatar,
}: Pick<FooterBaseProps, "displayName" | "role" | "profileHref" | "hasAvatar">) {
  const t = useT();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const roleLabel = role.replaceAll("_", " ").toUpperCase();
  const roleBadgeClass = ROLE_COLORS[role] ?? ROLE_BADGE_FALLBACK;

  return (
    <div className={cn("px-2 py-3", "border-t border-header-foreground/10")}>
      <div className="flex items-start gap-2.5">
        <Link
          href={profileHref}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-header-foreground/15 outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35"
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
            className="block truncate text-left text-caption font-medium tracking-[-0.02em] text-header-foreground/90 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35"
            title={displayName}
          >
            {displayName}
          </Link>
          <span
            className={cn(
              "mt-0.5 inline-block rounded-md px-2 py-0.5 text-micro font-medium uppercase tracking-wide",
              roleBadgeClass
            )}
          >
            {roleLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="shrink-0 rounded-lg p-1.5 text-header-foreground/70 transition-colors hover:bg-header-foreground/10 hover:text-header-foreground"
          title={t("topbar.signOut")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SidebarUserFooterSidebarChrome({
  displayName,
  role,
  profileHref,
  hasAvatar,
  versionLabel,
  settingsHref,
}: FooterBaseProps) {
  const t = useT();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const roleLabel = role.replaceAll("_", " ").toUpperCase();
  const roleBadgeClass = ROLE_COLORS[role] ?? ROLE_BADGE_FALLBACK;
  const settingsPath = settingsHref ?? "/settings";
  const { state, isMobile } = useSidebar();
  const isCollapsedRail = !isMobile && state === "collapsed";

  const avatarClassName =
    "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-header-foreground/15 outline-none transition-colors";

  const avatarInner = (
    <>
      {hasAvatar && !avatarFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/api/saas/profile/avatar"
          alt=""
          className="h-full w-full object-cover"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <User className="h-4 w-4 text-sidebar-foreground/80" />
      )}
    </>
  );

  const profileMenu = (
    <>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none text-foreground">{displayName}</p>
          <p className="text-xs leading-none text-muted-foreground">{roleLabel}</p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href={profileHref}>{t("nav.settings.profile")}</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={settingsPath} className="flex cursor-default items-center gap-2">
          <Settings className="h-4 w-4 shrink-0" />
          {t("nav.settings")}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        onSelect={() => {
          setTimeout(() => setSignOutOpen(true), 0);
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {t("topbar.signOut")}
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      <div
        className={cn(
          "border-sidebar-border text-sidebar-foreground",
          isCollapsedRail ? "px-1 py-2" : "px-2 py-3"
        )}
      >
        {isCollapsedRail ? (
          <div className="flex flex-col items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    avatarClassName,
                    "hover:bg-header-foreground/20 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  )}
                  aria-label={t("shell.profileMenu.open")}
                >
                  {avatarInner}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" side="right" align="end" sideOffset={8}>
                {profileMenu}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-start gap-2.5 rounded-lg p-1 text-left outline-none transition-colors hover:bg-header-foreground/5 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <span className={cn(avatarClassName, "pointer-events-none")}>{avatarInner}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium leading-snug tracking-[-0.02em] text-sidebar-foreground/88">
                      {displayName}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-md px-1.5 py-px text-[11px] font-medium uppercase tracking-wide",
                        roleBadgeClass
                      )}
                    >
                      {roleLabel}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" side="right" align="end" sideOffset={8}>
                {profileMenu}
              </DropdownMenuContent>
            </DropdownMenu>
            {versionLabel ? (
              <p className="mt-2 px-0.5 text-center text-micro text-sidebar-foreground/50">{versionLabel}</p>
            ) : null}
          </>
        )}
      </div>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("shell.signOutConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("shell.signOutConfirm.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">{t("shell.signOutConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              {t("shell.signOutConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

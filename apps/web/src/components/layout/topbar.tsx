"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, User, Bell, Building2, ChevronDown, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme";

type NotificationItem = {
  id: string;
  titleKey: string;
  link: string;
  createdAt: string;
  organizationName?: string;
  entityType: string;
  entityId: string;
};

interface TopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
  /** When true, show context switcher (Platform vs Partner). Only set in superadmin layout. */
  showContextSwitcher?: boolean;
  /** Current organization name (partner context). Shown next to title when set. */
  activeOrgName?: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-muted text-muted-foreground",
  ADMIN: "bg-muted text-muted-foreground",
  SALES: "bg-muted text-muted-foreground",
  VIEWER: "bg-muted text-muted-foreground",
};

type PartnerOption = { id: string; name: string };

export function TopBar({ user, showContextSwitcher, activeOrgName }: TopBarProps) {
  const { locale, setLocale, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const loadNotifications = useCallback(() => {
    setNotificationsLoading(true);
    fetch("/api/saas/notifications?limit=20")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false));
  }, []);

  useEffect(() => {
    if (bellOpen) loadNotifications();
  }, [bellOpen, loadNotifications]);

  useEffect(() => {
    if (!showContextSwitcher) return;
    let cancelled = false;
    fetch("/api/saas/partners?limit=100")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.partners) {
          setPartners(data.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showContextSwitcher]);

  const setActiveOrg = async (organizationId: string | null) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/saas/set-active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (res.ok) {
        setSwitcherOpen(false);
        router.push(organizationId ? "/dashboard" : "/superadmin/dashboard");
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="h-14 bg-header border-b border-header-foreground/10 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-header-foreground">{t("topbar.title")}</h1>
        <span className="text-header-foreground/40">|</span>
        {showContextSwitcher ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              disabled={switching}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-header-foreground/90 hover:bg-header-foreground/10 border border-header-foreground/20"
            >
              <Building2 className="h-4 w-4" />
              <span>{t("topbar.viewAs")}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {switcherOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setSwitcherOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] rounded-lg border border-border bg-popover shadow-lg py-1 text-left">
                  <button
                    type="button"
                    onClick={() => setActiveOrg(null)}
                    className="w-full px-3 py-2 text-sm text-popover-foreground hover:bg-muted text-left"
                  >
                    Platform (all)
                  </button>
                  {partners.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveOrg(p.id)}
                      className="w-full px-3 py-2 text-sm text-popover-foreground hover:bg-muted text-left flex items-center gap-2"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-sm text-header-foreground/70">{activeOrgName ?? t("topbar.org")}</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-header-foreground/70 hover:text-header-foreground hover:bg-header-foreground/10 transition-colors"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-header-foreground/20 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setLocale("en")}
            className={`px-2.5 py-1.5 transition-colors ${
              locale === "en"
                ? "bg-header-foreground/20 text-header-foreground"
                : "text-header-foreground/70 hover:bg-header-foreground/10"
            }`}
          >
            ENG
          </button>
          <button
            onClick={() => setLocale("es")}
            className={`px-2.5 py-1.5 transition-colors ${
              locale === "es"
                ? "bg-header-foreground/20 text-header-foreground"
                : "text-header-foreground/70 hover:bg-header-foreground/10"
            }`}
          >
            ESP
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((o) => !o)}
            className="relative p-2 text-header-foreground/70 hover:text-header-foreground transition-colors rounded-lg"
            aria-expanded={bellOpen}
            aria-haspopup="true"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-xs font-medium flex items-center justify-center">
                {notifications.length > 99 ? "99+" : notifications.length}
              </span>
            )}
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-[320px] max-h-[400px] overflow-hidden rounded-lg border border-border bg-popover shadow-xl flex flex-col">
                <div className="px-3 py-2 border-b border-border font-medium text-popover-foreground text-sm">
                  {t("notifications.title")}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notificationsLoading ? (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">{t("notifications.empty")}</div>
                  ) : (
                    <ul className="py-1">
                      {notifications.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.link}
                            onClick={() => setBellOpen(false)}
                            className="block px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted border-b border-border last:border-b-0"
                          >
                            <span className="font-medium">{t(n.titleKey)}</span>
                            {n.organizationName && (
                              <span className="block text-xs text-muted-foreground mt-0.5">{n.organizationName}</span>
                            )}
                            <span className="block text-xs text-muted-foreground/80 mt-0.5">
                              {new Date(n.createdAt).toLocaleString(locale, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-header-foreground/20 flex items-center justify-center">
            <User className="w-4 h-4 text-header-foreground" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-header-foreground leading-tight">
              {user.name ?? user.email}
            </p>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[user.role] ?? "bg-header-foreground/20 text-header-foreground"}`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 text-header-foreground/70 hover:text-header-foreground transition-colors"
          title={t("topbar.signOut")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

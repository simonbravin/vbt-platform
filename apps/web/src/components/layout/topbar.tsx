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

const NOTIFICATIONS_LAST_READ_KEY = "vbt_notifications_last_read_at";
const NOTIFICATIONS_BADGE_LIMIT = 10;
const NOTIFICATIONS_DROPDOWN_LIMIT = 10;

function getLastReadAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(NOTIFICATIONS_LAST_READ_KEY);
  if (!raw) return null;
  const t = parseInt(raw, 10);
  return Number.isFinite(t) ? t : null;
}

function setLastReadAt() {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_LAST_READ_KEY, String(Date.now()));
}

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
  const [badgeNotifications, setBadgeNotifications] = useState<NotificationItem[]>([]);
  const [lastReadAt, setLastReadAtState] = useState<number | null>(null);

  useEffect(() => {
    setLastReadAtState(getLastReadAt());
  }, []);

  const loadNotifications = useCallback((limit: number, forDropdown: boolean) => {
    if (forDropdown) setNotificationsLoading(true);
    fetch(`/api/saas/notifications?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (forDropdown) {
          setNotifications(list);
          setLastReadAt();
          setLastReadAtState(Date.now());
        } else {
          setBadgeNotifications(list);
        }
      })
      .catch(() => {
        if (forDropdown) setNotifications([]);
        else setBadgeNotifications([]);
      })
      .finally(() => {
        if (forDropdown) setNotificationsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadNotifications(NOTIFICATIONS_BADGE_LIMIT, false);
  }, [loadNotifications]);

  useEffect(() => {
    if (bellOpen) {
      loadNotifications(NOTIFICATIONS_DROPDOWN_LIMIT, true);
    }
  }, [bellOpen, loadNotifications]);

  const unreadCount =
    lastReadAt == null
      ? badgeNotifications.length
      : badgeNotifications.filter((n) => new Date(n.createdAt).getTime() > lastReadAt).length;
  const badgeCount = bellOpen ? 0 : unreadCount;

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
      // API expects { organizationId: string (UUID) | null }; never send undefined or ""
      const body = { organizationId: organizationId && organizationId.trim() ? organizationId : null };
      const res = await fetch("/api/saas/set-active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSwitcherOpen(false);
        router.push(body.organizationId ? "/dashboard" : "/superadmin/dashboard");
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="h-14 bg-header border-b border-header-foreground/15 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-header-foreground tracking-tight">{t("topbar.title")}</h1>
        <span className="text-header-foreground/40">|</span>
        {showContextSwitcher ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              disabled={switching}
              className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm text-header-foreground/90 hover:bg-header-foreground/10 border border-header-foreground/20"
            >
              <Building2 className="h-4 w-4" />
              <span>{t("topbar.viewAs")}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {switcherOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setSwitcherOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] rounded-sm border border-border bg-popover py-1 text-left shadow-none ring-1 ring-border/60">
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
          className="p-2 rounded-sm text-header-foreground/70 hover:text-header-foreground hover:bg-header-foreground/10 transition-colors"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {/* Language toggle */}
        <div className="flex items-center rounded-sm border border-header-foreground/20 overflow-hidden text-xs font-medium">
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
            className="relative p-2 text-header-foreground/70 hover:text-header-foreground transition-colors rounded-sm"
            aria-expanded={bellOpen}
            aria-haspopup="true"
          >
            <Bell className="w-5 h-5" />
            {badgeCount > 0 && (
              <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-[320px] max-h-[400px] overflow-hidden rounded-sm border border-border bg-popover flex flex-col ring-1 ring-border/60">
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
              className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${ROLE_COLORS[user.role] ?? "bg-header-foreground/20 text-header-foreground"}`}
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

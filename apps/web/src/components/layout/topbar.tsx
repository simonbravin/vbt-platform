"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Building2, ChevronDown, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme";
import { CustomSidebarTrigger } from "@/components/layout/custom-sidebar-trigger";
import { ShellBreadcrumb } from "@/components/layout/shell-breadcrumb";
import { Separator } from "@/components/ui/separator";

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
  /** When true, show context switcher (Platform vs Partner). Only set in superadmin layout. */
  showContextSwitcher?: boolean;
  /** Current organization name (partner context). Shown next to title when set. */
  activeOrgName?: string | null;
}

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

export function TopBar({ showContextSwitcher, activeOrgName }: TopBarProps) {
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
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CustomSidebarTrigger />
        <Separator className="h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
        <div className="min-w-0 shrink">
          <ShellBreadcrumb />
        </div>
        {showContextSwitcher ? (
          <>
            <Separator className="hidden h-4 data-[orientation=vertical]:self-center sm:flex" orientation="vertical" />
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setSwitcherOpen((o) => !o)}
                disabled={switching}
                className="flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{t("topbar.viewAs")}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
              {switcherOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setSwitcherOpen(false)} />
                  <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] rounded-lg border border-border/80 bg-popover py-1 text-left text-popover-foreground shadow-none">
                    <button
                      type="button"
                      onClick={() => setActiveOrg(null)}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-popover-foreground hover:bg-muted"
                    >
                      Platform (all)
                    </button>
                    {partners.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveOrg(p.id)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] text-popover-foreground hover:bg-muted"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <Separator className="hidden h-4 data-[orientation=vertical]:self-center md:flex" orientation="vertical" />
            <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:inline">
              {activeOrgName ?? t("topbar.org")}
            </span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="flex items-center overflow-hidden rounded-full border border-border text-[12px] font-medium">
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={`px-3 py-1.5 transition-colors ${
              locale === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            ENG
          </button>
          <button
            type="button"
            onClick={() => setLocale("es")}
            className={`px-3 py-1.5 transition-colors ${
              locale === "es" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            ESP
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((o) => !o)}
            className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={bellOpen}
            aria-haspopup="true"
          >
            <Bell className="w-5 h-5" />
            {badgeCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 flex max-h-[400px] w-[320px] flex-col overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-none">
                <div className="border-b border-border/80 px-4 py-3 text-[15px] font-semibold">
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
      </div>
    </header>
  );
}

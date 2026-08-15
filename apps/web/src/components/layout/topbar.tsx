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
import { PartnerUpdateChangesList } from "@/components/activity/PartnerUpdateChangesList";
import type { NotificationStructuredDetail } from "@/lib/notification-enrichment";
import { INVENTORY_TX_LABEL_CODES } from "@/lib/notification-enrichment";

type NotificationItem = {
  id: string;
  action?: string;
  titleKey: string;
  link: string;
  createdAt: string;
  organizationName?: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
  actorDisplay?: string | null;
  detail?: NotificationStructuredDetail | null;
};

function NotificationBellStructuredDetail({
  detail,
  t,
}: {
  detail: NotificationStructuredDetail;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (detail.kind === "subtitle") {
    return <span className="whitespace-normal break-words">{detail.parts.join(" · ")}</span>;
  }
  if (detail.kind === "inventory_movement") {
    const typeLabel = INVENTORY_TX_LABEL_CODES.has(detail.movementType)
      ? t(`admin.inventory.txType.${detail.movementType}`)
      : detail.movementType;
    const delta = t("notifications.inventoryDelta", { n: detail.quantityDelta });
    const len = detail.lengthMm !== undefined ? ` · ${detail.lengthMm} mm` : "";
    const buckets = detail.lineCount != null ? ` · ×${detail.lineCount}` : "";
    const bits = [
      typeLabel,
      detail.pieceName || null,
      detail.warehouseName || null,
      delta,
    ].filter(Boolean);
    return (
      <span className="whitespace-normal break-words">
        {bits.join(" · ")}
        {len}
        {buckets}
      </span>
    );
  }
  if (detail.kind === "inventory_bulk") {
    const typeLabel = INVENTORY_TX_LABEL_CODES.has(detail.movementType)
      ? t(`admin.inventory.txType.${detail.movementType}`)
      : detail.movementType;
    const pieces =
      detail.distinctPieces > 0 ? t("notifications.inventoryPieces", { count: detail.distinctPieces }) : null;
    const bits = [detail.fileName || null, detail.warehouseName || null, typeLabel, pieces].filter(Boolean);
    return <span className="whitespace-normal break-words">{bits.join(" · ")}</span>;
  }
  if (detail.kind === "inventory_prune") {
    return <span>{t("notifications.inventoryPrunedDetail", { count: detail.deleted })}</span>;
  }
  return null;
}

interface TopBarProps {
  /** When true, show context switcher (Platform vs Partner). Superadmin only. */
  showContextSwitcher?: boolean;
  /** Portal badge. Independent of the switcher so VL-as-partner still reads “partner”. */
  portal?: "partner" | "platform";
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

export function TopBar({ showContextSwitcher, portal, activeOrgName }: TopBarProps) {
  const portalKind = portal ?? (showContextSwitcher ? "platform" : "partner");
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
        <span className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:inline">
          {portalKind === "platform" ? t("shell.portal.platform") : t("shell.portal.partner")}
        </span>
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
                      {t("topbar.platformAll")}
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
          title={theme === "dark" ? t("topbar.themeToLight") : t("topbar.themeToDark")}
          aria-label={theme === "dark" ? t("topbar.themeToLight") : t("topbar.themeToDark")}
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
              <div className="absolute right-0 top-full mt-2 z-20 flex max-h-[min(85vh,32rem)] w-[min(100vw-1rem,36rem)] flex-col overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-none">
                <div className="border-b border-border/80 px-4 py-3 text-[15px] font-semibold">
                  {t("notifications.title")}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notificationsLoading ? (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">{t("notifications.empty")}</div>
                  ) : (
                    <ul className="divide-y divide-border/80">
                      {notifications.map((n) => {
                        const metaParts = [
                          n.organizationName ?? null,
                          n.actorDisplay ? t("notifications.byUser", { name: n.actorDisplay }) : null,
                        ].filter(Boolean) as string[];
                        const timeStr = new Date(n.createdAt).toLocaleString(locale, {
                          dateStyle: "short",
                          timeStyle: "short",
                        });
                        return (
                          <li key={n.id}>
                            <Link
                              href={n.link}
                              onClick={() => setBellOpen(false)}
                              className="block px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 leading-snug line-clamp-2">
                                  <span className="font-medium text-foreground">{t(n.titleKey)}</span>
                                  {n.detail ? (
                                    <>
                                      <span className="text-muted-foreground font-normal"> — </span>
                                      <span className="font-normal text-foreground/90">
                                        <NotificationBellStructuredDetail detail={n.detail} t={t} />
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                                <time
                                  dateTime={n.createdAt}
                                  className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground"
                                >
                                  {timeStr}
                                </time>
                              </div>
                              {metaParts.length > 0 ? (
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">{metaParts.join(" · ")}</div>
                              ) : null}
                              {n.action?.toLowerCase() === "partner_updated" && n.metadata ? (
                                <div className="mt-0.5 min-w-0">
                                  <PartnerUpdateChangesList
                                    changes={(n.metadata as { changes?: unknown })?.changes}
                                    compact
                                    maxItems={2}
                                  />
                                </div>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Package,
  Building2,
  Users,
  Settings,
  BarChart3,
  ShoppingCart,
  Wrench,
  FileStack,
  GraduationCap,
  Receipt,
  User,
  ChevronRight,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { SidebarUserFooter } from "@/components/layout/sidebar-user-footer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

interface NavItem {
  labelKey: string;
  href?: string;
  icon: React.ElementType;
  roles?: string[];
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.clients", href: "/clients", icon: Building2 },
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.engineering", href: "/engineering", icon: Wrench },
  { labelKey: "nav.quotes", href: "/quotes", icon: FileText },
  {
    labelKey: "nav.sales",
    icon: ShoppingCart,
    roles: ["org_admin", "sales_user", "technical_user", "viewer"],
    children: [
      { labelKey: "nav.sales.list", href: "/sales", icon: ShoppingCart },
      { labelKey: "nav.sales.statements", href: "/sales/statements", icon: Receipt },
    ],
  },
  { labelKey: "nav.inventory", href: "/inventory", icon: Package },
  { labelKey: "nav.documents", href: "/documents", icon: FileStack },
  { labelKey: "nav.training", href: "/training", icon: GraduationCap },
  { labelKey: "nav.reports", href: "/reports", icon: BarChart3, roles: ["SUPERADMIN", "org_admin", "sales_user"] },
  {
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["SUPERADMIN", "org_admin"],
    children: [
      { labelKey: "nav.settings.overview", href: "/settings", icon: Settings },
      { labelKey: "nav.settings.profile", href: "/profile", icon: User },
      { labelKey: "nav.team", href: "/settings/team", icon: Users },
    ],
  },
];

interface SidebarProps {
  role: string;
  userDisplayName?: string | null;
  hasAvatar?: boolean;
  profileHref?: string;
  moduleVisibility?: {
    dashboard?: boolean;
    clients?: boolean;
    engineering?: boolean;
    projects?: boolean;
    quotes?: boolean;
    sales?: boolean;
    inventory?: boolean;
    documents?: boolean;
    training?: boolean;
    reports?: boolean;
    settings?: boolean;
  };
}

function isModuleVisible(moduleVisibility: SidebarProps["moduleVisibility"], href?: string) {
  if (!href) return true;
  if (href === "/dashboard") return moduleVisibility?.dashboard !== false;
  if (href === "/clients") return moduleVisibility?.clients !== false;
  if (href === "/engineering") return moduleVisibility?.engineering !== false;
  if (href === "/projects") return moduleVisibility?.projects !== false;
  if (href === "/quotes") return moduleVisibility?.quotes !== false;
  if (href === "/sales" || href.startsWith("/sales/")) return moduleVisibility?.sales !== false;
  if (href === "/inventory") return moduleVisibility?.inventory !== false;
  if (href === "/documents") return moduleVisibility?.documents !== false;
  if (href === "/training") return moduleVisibility?.training !== false;
  if (href === "/reports") return moduleVisibility?.reports !== false;
  if (href === "/settings" || href.startsWith("/settings/")) return moduleVisibility?.settings !== false;
  return true;
}

function isNavLinkActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/sales") {
    if (pathname.startsWith("/sales/statements")) return false;
    return pathname.startsWith("/sales/");
  }
  return pathname.startsWith(`${href}/`);
}

export function Sidebar({ role, userDisplayName, hasAvatar, profileHref, moduleVisibility }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (pathname.startsWith("/sales")) {
      setExpanded((prev) => (prev.includes("nav.sales") ? prev : [...prev, "nav.sales"]));
    }
    if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) {
      setExpanded((prev) => (prev.includes("nav.settings") ? prev : [...prev, "nav.settings"]));
    }
  }, [pathname]);

  const canSee = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  };

  const parentHref = (item: NavItem & { children: NavItem[] }) => {
    const first = item.children.find((c) => c.href && canSee(c) && isModuleVisible(moduleVisibility, c.href));
    return first?.href ?? "#";
  };

  return (
    <SidebarRoot collapsible="icon" variant="inset">
      <div className="box-border flex h-14 flex-shrink-0 flex-col border-b border-header-foreground/10 px-3 py-0.5">
        <Link
          href="/dashboard"
          className="flex max-h-full min-h-0 w-full flex-1 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-background))]"
          aria-label={t("nav.dashboard")}
        >
          <Image
            src="/logo-vbt-white-horizontal.png"
            alt=""
            width={240}
            height={56}
            draggable={false}
            className="max-h-[calc(3.5rem-0.25rem)] h-auto w-auto max-w-full object-contain object-center opacity-95 select-none [-webkit-user-drag:none] group-data-[collapsible=icon]/sidebar-wrapper:max-h-8 group-data-[collapsible=icon]/sidebar-wrapper:max-w-[2rem]"
            priority
          />
        </Link>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("shell.nav.menu")}</SidebarGroupLabel>
          <SidebarMenu>
            {navigation
              .filter(canSee)
              .filter((item) => {
                if (item.children?.length) {
                  return item.children.some((c) => c.href && isModuleVisible(moduleVisibility, c.href));
                }
                return isModuleVisible(moduleVisibility, item.href);
              })
              .map((item) => {
                if (item.children?.length) {
                  const open = expanded.includes(item.labelKey);
                  const hasActiveChild = item.children.some(
                    (child) => child.href && isNavLinkActive(pathname, child.href)
                  );
                  const ph = parentHref(item as NavItem & { children: NavItem[] });

                  return (
                    <Collapsible
                      key={item.labelKey}
                      open={open}
                      onOpenChange={(next) => {
                        setExpanded((prev) =>
                          next ? (prev.includes(item.labelKey) ? prev : [...prev, item.labelKey]) : prev.filter((k) => k !== item.labelKey)
                        );
                      }}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={hasActiveChild}
                          tooltip={t(item.labelKey)}
                        >
                          <Link href={ph}>
                            <item.icon className="shrink-0" />
                            <span>{t(item.labelKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction
                            aria-label={t("shell.expandGroup")}
                            className="data-[state=open]:rotate-90"
                          >
                            <ChevronRight className="size-4" />
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children
                              .filter(canSee)
                              .filter((child) => isModuleVisible(moduleVisibility, child.href))
                              .map((child) => (
                                <SidebarMenuSubItem key={child.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={Boolean(child.href && isNavLinkActive(pathname, child.href))}
                                  >
                                    <Link href={child.href!}>
                                      <child.icon className="size-4 shrink-0" />
                                      <span>{t(child.labelKey)}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={Boolean(item.href && isNavLinkActive(pathname, item.href))}
                      tooltip={t(item.labelKey)}
                    >
                      <Link href={item.href!}>
                        <item.icon className="shrink-0" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {userDisplayName?.trim() && profileHref ? (
          <SidebarUserFooter
            displayName={userDisplayName.trim()}
            role={role}
            hasAvatar={hasAvatar}
            profileHref={profileHref}
            surface="sidebar"
            settingsHref="/settings"
            versionLabel={t("sidebar.footerVersion")}
          />
        ) : null}
      </SidebarFooter>
    </SidebarRoot>
  );
}

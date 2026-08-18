"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Warehouse,
  Truck,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { SidebarUserFooter } from "@/components/layout/sidebar-user-footer";
import {
  SidebarNavSections,
  type SidebarNavGroup,
  type SidebarNavItem,
} from "@/components/layout/sidebar-nav-sections";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navigation: SidebarNavGroup[] = [
  {
    labelKey: null,
    items: [{ labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.group.portfolio",
    items: [
      { labelKey: "nav.clients", href: "/clients", icon: Building2 },
      { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
      { labelKey: "nav.engineering", href: "/engineering", icon: Wrench },
    ],
  },
  {
    labelKey: "nav.group.commercial",
    items: [
      {
        labelKey: "nav.quotes",
        href: "/quotes",
        icon: FileText,
        activeExclude: ["/quotes/wizard", "/quotes/new", "/quotes/create"],
      },
      {
        labelKey: "nav.sales.list",
        href: "/sales",
        icon: ShoppingCart,
        roles: ["org_admin", "sales_user"],
        activeExclude: ["/sales/statements"],
      },
      { labelKey: "nav.sales.statements", href: "/sales/statements", icon: Receipt, roles: ["org_admin", "sales_user"] },
      { labelKey: "nav.reports", href: "/reports", icon: BarChart3, roles: ["org_admin", "sales_user"] },
    ],
  },
  {
    labelKey: "nav.group.operations",
    items: [{ labelKey: "nav.inventory", href: "/inventory", icon: Package }],
  },
  {
    labelKey: "nav.group.resources",
    items: [
      { labelKey: "nav.documents", href: "/documents", icon: FileStack },
      { labelKey: "nav.training", href: "/training", icon: GraduationCap },
    ],
  },
  {
    labelKey: "nav.settings",
    items: [
      { labelKey: "nav.settings.overview", href: "/settings", icon: Settings, roles: ["org_admin"], activeExact: true },
      { labelKey: "nav.team", href: "/settings/team", icon: Users, roles: ["org_admin"] },
      { labelKey: "nav.warehouses", href: "/settings/warehouses", icon: Warehouse, roles: ["org_admin"] },
      { labelKey: "nav.freight", href: "/settings/freight", icon: Truck, roles: ["org_admin"] },
      { labelKey: "nav.taxes", href: "/settings/taxes", icon: TrendingUp, roles: ["org_admin"] },
      { labelKey: "nav.settings.activity", href: "/settings/activity", icon: ClipboardList, roles: ["org_admin"] },
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
  if (href === "/quotes" || href.startsWith("/quotes/")) return moduleVisibility?.quotes !== false;
  if (href === "/sales" || href.startsWith("/sales/")) return moduleVisibility?.sales !== false;
  if (href === "/inventory") return moduleVisibility?.inventory !== false;
  if (href === "/documents") return moduleVisibility?.documents !== false;
  if (href === "/training") return moduleVisibility?.training !== false;
  if (href === "/reports") return moduleVisibility?.reports !== false;
  if (href === "/settings" || href.startsWith("/settings/")) return moduleVisibility?.settings !== false;
  return true;
}

export function Sidebar({ role, userDisplayName, hasAvatar, profileHref, moduleVisibility }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();

  const canSee = (item: SidebarNavItem) => {
    if (item.roles && !item.roles.includes(role)) return false;
    return isModuleVisible(moduleVisibility, item.href);
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

      <SidebarContent className="gap-0.5">
        <SidebarNavSections groups={navigation} pathname={pathname} t={t} isItemVisible={canSee} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {userDisplayName?.trim() && profileHref ? (
          <SidebarUserFooter
            displayName={userDisplayName.trim()}
            role={role}
            hasAvatar={hasAvatar}
            profileHref={profileHref}
            surface="sidebar"
            settingsHref={role === "org_admin" ? "/settings" : undefined}
            versionLabel={t("sidebar.footerVersion")}
          />
        ) : null}
      </SidebarFooter>
    </SidebarRoot>
  );
}

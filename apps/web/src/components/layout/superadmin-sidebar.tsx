"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Activity,
  FileText,
  BookOpen,
  Settings,
  Users,
  Building,
  Warehouse,
  Globe,
  Truck,
  TrendingUp,
  Package,
  ClipboardList,
  FolderOpen,
  Wrench,
  ShoppingCart,
  Brain,
  Award,
  User,
  ListChecks,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { SidebarUserFooter } from "@/components/layout/sidebar-user-footer";
import { SidebarPortalBadge } from "@/components/layout/sidebar-portal-badge";
import { SidebarNavSections, type SidebarNavGroup } from "@/components/layout/sidebar-nav-sections";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";

const superadminNavigation: SidebarNavGroup[] = [
  {
    labelKey: null,
    items: [{ labelKey: "nav.superadmin.dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.group.network",
    items: [{ labelKey: "nav.superadmin.partners", href: "/superadmin/partners", icon: Building2 }],
  },
  {
    labelKey: "nav.group.operations",
    items: [
      { labelKey: "nav.superadmin.projects", href: "/superadmin/projects", icon: FolderOpen },
      { labelKey: "nav.superadmin.engineering", href: "/superadmin/engineering", icon: Wrench },
      { labelKey: "nav.superadmin.quotes", href: "/superadmin/quotes", icon: ClipboardList },
      {
        labelKey: "nav.superadmin.sales",
        href: "/superadmin/sales",
        icon: ShoppingCart,
        activeExclude: ["/superadmin/sales/statements"],
      },
    ],
  },
  {
    labelKey: "nav.group.factory",
    items: [
      { labelKey: "nav.catalog", href: "/superadmin/admin/catalog", icon: BookOpen },
      { labelKey: "nav.superadmin.inventory", href: "/superadmin/admin/inventory", icon: Package },
      { labelKey: "nav.warehouses", href: "/superadmin/admin/warehouses", icon: Warehouse },
      { labelKey: "nav.freight", href: "/superadmin/admin/freight", icon: Truck },
    ],
  },
  {
    labelKey: "nav.group.country",
    items: [
      { labelKey: "nav.countries.onboard", href: "/superadmin/countries/onboard", icon: ListChecks },
      { labelKey: "nav.countries", href: "/superadmin/admin/countries", icon: Globe },
      { labelKey: "nav.taxes", href: "/superadmin/admin/taxes", icon: TrendingUp },
    ],
  },
  {
    labelKey: "nav.superadmin.content",
    items: [
      { labelKey: "nav.superadmin.documents", href: "/superadmin/documents", icon: FileText },
      {
        labelKey: "nav.superadmin.training",
        href: "/superadmin/training",
        icon: BookOpen,
        activeExclude: ["/superadmin/training/certificates"],
      },
      { labelKey: "nav.superadmin.trainingCertificates", href: "/superadmin/training/certificates", icon: Award },
      { labelKey: "nav.superadmin.quizzes", href: "/superadmin/quizzes", icon: Brain },
    ],
  },
  {
    labelKey: "nav.group.insights",
    items: [
      { labelKey: "nav.superadmin.analytics", href: "/superadmin/analytics", icon: BarChart3 },
      { labelKey: "nav.superadmin.activity", href: "/superadmin/activity", icon: Activity },
    ],
  },
  {
    labelKey: "nav.group.system",
    items: [
      { labelKey: "nav.superadmin.settings", href: "/superadmin/settings", icon: Settings, activeExact: true },
      { labelKey: "nav.settings.profile", href: "/superadmin/settings/profile", icon: User },
      { labelKey: "nav.superadmin.pendingApprovals", href: "/superadmin/admin/users", icon: Users },
      { labelKey: "nav.entities", href: "/superadmin/admin/entities", icon: Building },
      { labelKey: "nav.superadmin.emailPreviews", href: "/superadmin/emails/preview", icon: FileText },
    ],
  },
];

interface SuperadminSidebarProps {
  userDisplayName?: string | null;
  hasAvatar?: boolean;
  profileHref?: string;
}

export function SuperadminSidebar({ userDisplayName, hasAvatar, profileHref }: SuperadminSidebarProps) {
  const pathname = usePathname();
  const t = useT();

  return (
    <SidebarRoot collapsible="icon" variant="inset">
      <div className="box-border flex h-14 flex-shrink-0 flex-col border-b border-header-foreground/10 px-3 py-0.5">
        <Link
          href="/superadmin/dashboard"
          className="flex max-h-full min-h-0 w-full flex-1 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-background))]"
          aria-label={t("nav.superadmin.dashboard")}
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
      <SidebarPortalBadge label={t("shell.portal.platform")} />

      <SidebarContent className="gap-0.5">
        <SidebarNavSections groups={superadminNavigation} pathname={pathname} t={t} isItemVisible={() => true} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {userDisplayName?.trim() && profileHref ? (
          <SidebarUserFooter
            displayName={userDisplayName.trim()}
            role="SUPERADMIN"
            hasAvatar={hasAvatar}
            profileHref={profileHref}
            surface="sidebar"
            settingsHref="/superadmin/settings"
            versionLabel={t("sidebar.superadminPortal")}
          />
        ) : null}
      </SidebarFooter>
    </SidebarRoot>
  );
}

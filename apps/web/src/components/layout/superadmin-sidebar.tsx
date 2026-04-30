"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Activity,
  FileText,
  BookOpen,
  Settings,
  ChevronRight,
  FileBarChart,
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
  children?: NavItem[];
}

const superadminNavigation: NavItem[] = [
  { labelKey: "nav.superadmin.dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.superadmin.partners", href: "/superadmin/partners", icon: Building2 },
  { labelKey: "nav.superadmin.projects", href: "/superadmin/projects", icon: FolderOpen },
  { labelKey: "nav.superadmin.engineering", href: "/superadmin/engineering", icon: Wrench },
  { labelKey: "nav.superadmin.quotes", href: "/superadmin/quotes", icon: ClipboardList },
  { labelKey: "nav.superadmin.sales", href: "/superadmin/sales", icon: ShoppingCart },
  { labelKey: "nav.superadmin.inventory", href: "/superadmin/admin/inventory", icon: Package },
  {
    labelKey: "nav.superadmin.content",
    icon: FileText,
    children: [
      { labelKey: "nav.superadmin.documents", href: "/superadmin/documents", icon: FileText },
      { labelKey: "nav.superadmin.training", href: "/superadmin/training", icon: BookOpen },
      { labelKey: "nav.superadmin.trainingCertificates", href: "/superadmin/training/certificates", icon: Award },
      { labelKey: "nav.superadmin.certificateVerify", href: "/superadmin/training/certificates/verify", icon: Award },
      { labelKey: "nav.superadmin.quizzes", href: "/superadmin/quizzes", icon: Brain },
    ],
  },
  { labelKey: "nav.superadmin.analytics", href: "/superadmin/analytics", icon: BarChart3 },
  { labelKey: "nav.superadmin.reports", href: "/superadmin/reports", icon: FileBarChart },
  { labelKey: "nav.superadmin.activity", href: "/superadmin/activity", icon: Activity },
  {
    labelKey: "nav.admin",
    icon: Settings,
    children: [
      { labelKey: "nav.superadmin.settings", href: "/superadmin/settings", icon: Settings },
      { labelKey: "nav.settings.profile", href: "/superadmin/settings/profile", icon: User },
      { labelKey: "nav.superadmin.pendingApprovals", href: "/superadmin/admin/users", icon: Users },
      { labelKey: "nav.entities", href: "/superadmin/admin/entities", icon: Building },
      { labelKey: "nav.catalog", href: "/superadmin/admin/catalog", icon: BookOpen },
      { labelKey: "nav.warehouses", href: "/superadmin/admin/warehouses", icon: Warehouse },
      { labelKey: "nav.countries", href: "/superadmin/admin/countries", icon: Globe },
      { labelKey: "nav.freight", href: "/superadmin/admin/freight", icon: Truck },
      { labelKey: "nav.taxes", href: "/superadmin/admin/taxes", icon: TrendingUp },
      { labelKey: "nav.superadmin.emailPreviews", href: "/superadmin/emails/preview", icon: FileText },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SuperadminSidebarProps {
  userDisplayName?: string | null;
  hasAvatar?: boolean;
  profileHref?: string;
}

export function SuperadminSidebar({ userDisplayName, hasAvatar, profileHref }: SuperadminSidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (
      pathname.startsWith("/superadmin/documents") ||
      pathname.startsWith("/superadmin/training") ||
      pathname.startsWith("/superadmin/quizzes")
    ) {
      setExpanded((prev) => (prev.includes("nav.superadmin.content") ? prev : [...prev, "nav.superadmin.content"]));
    }
    if (
      pathname.startsWith("/superadmin/settings") ||
      pathname.startsWith("/superadmin/admin") ||
      pathname.startsWith("/superadmin/emails")
    ) {
      setExpanded((prev) => (prev.includes("nav.admin") ? prev : [...prev, "nav.admin"]));
    }
  }, [pathname]);

  const parentHref = (item: NavItem & { children: NavItem[] }) => {
    const first = item.children.find((c) => c.href);
    return first?.href ?? "#";
  };

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

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("shell.nav.platform")}</SidebarGroupLabel>
          <SidebarMenu>
            {superadminNavigation.map((item) => {
              if (item.children?.length) {
                const open = expanded.includes(item.labelKey);
                const hasActiveChild = item.children.some((child) => child.href && isActive(pathname, child.href));
                const ph = parentHref(item as NavItem & { children: NavItem[] });

                return (
                  <Collapsible
                    key={item.labelKey}
                    open={open}
                    onOpenChange={(next) => {
                      setExpanded((prev) =>
                        next
                          ? prev.includes(item.labelKey)
                            ? prev
                            : [...prev, item.labelKey]
                          : prev.filter((k) => k !== item.labelKey)
                      );
                    }}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={hasActiveChild} tooltip={t(item.labelKey)}>
                        <Link href={ph}>
                          <item.icon className="shrink-0" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction aria-label={t("shell.expandGroup")} className="data-[state=open]:rotate-90">
                          <ChevronRight className="size-4" />
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={Boolean(child.href && isActive(pathname, child.href!))}
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
                    isActive={Boolean(item.href && isActive(pathname, item.href))}
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

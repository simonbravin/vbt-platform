"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Activity,
  FileText,
  BookOpen,
  Settings,
  ChevronDown,
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
} from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n/context";

interface NavItem {
  labelKey: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const superadminNavigation: NavItem[] = [
  { labelKey: "nav.superadmin.dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.superadmin.partners", href: "/superadmin/partners", icon: Building2 },
  { labelKey: "nav.superadmin.quotes", href: "/superadmin/quotes", icon: ClipboardList },
  { labelKey: "nav.superadmin.projects", href: "/superadmin/projects", icon: FolderOpen },
  { labelKey: "nav.superadmin.analytics", href: "/superadmin/analytics", icon: BarChart3 },
  { labelKey: "nav.superadmin.reports", href: "/superadmin/reports", icon: FileBarChart },
  { labelKey: "nav.superadmin.activity", href: "/superadmin/activity", icon: Activity },
  { labelKey: "nav.superadmin.inventory", href: "/superadmin/admin/inventory", icon: Package },
  {
    labelKey: "nav.superadmin.content",
    icon: FileText,
    children: [
      { labelKey: "nav.superadmin.documents", href: "/superadmin/documents", icon: FileText },
      { labelKey: "nav.superadmin.training", href: "/superadmin/training", icon: BookOpen },
    ],
  },
  {
    labelKey: "nav.admin",
    icon: Settings,
    children: [
      { labelKey: "nav.superadmin.settings", href: "/superadmin/settings", icon: Settings },
      { labelKey: "nav.superadmin.pendingApprovals", href: "/superadmin/admin/users", icon: Users },
      { labelKey: "nav.entities", href: "/superadmin/admin/entities", icon: Building },
      { labelKey: "nav.catalog", href: "/superadmin/admin/catalog", icon: BookOpen },
      { labelKey: "nav.warehouses", href: "/superadmin/admin/warehouses", icon: Warehouse },
      { labelKey: "nav.countries", href: "/superadmin/admin/countries", icon: Globe },
      { labelKey: "nav.freight", href: "/superadmin/admin/freight", icon: Truck },
      { labelKey: "nav.taxes", href: "/superadmin/admin/taxes", icon: TrendingUp },
    ],
  },
];

interface SuperadminSidebarProps {
  userDisplayName?: string | null;
}

export function SuperadminSidebar({ userDisplayName }: SuperadminSidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>(["nav.superadmin.content", "nav.admin"]);

  const toggle = (key: string) => {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((l) => l !== key) : [...prev, key]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="w-64 bg-header flex flex-col h-full shadow-xl flex-shrink-0">
      <div className="px-3 py-4 border-b border-header-foreground/10 flex items-center">
        <Image
          src="/logo-vbt-white-horizontal.png"
          alt="Vision Latam"
          width={240}
          height={56}
          className="w-full h-11 object-contain object-left"
        />
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        <p className="px-3 py-1.5 text-xs font-medium text-header-foreground/50 uppercase tracking-wider">
          Platform
        </p>
        {superadminNavigation.map((item) => {
          if (item.children) {
            const isOpen = expanded.includes(item.labelKey);
            const hasActiveChild = item.children.some(
              (child) => child.href && isActive(child.href)
            );
            return (
              <div key={item.labelKey}>
                <button
                  type="button"
                  onClick={() => toggle(item.labelKey)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    hasActiveChild
                      ? "text-header-foreground bg-header-foreground/10"
                      : "text-header-foreground/70 hover:text-header-foreground hover:bg-header-foreground/10"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{t(item.labelKey)}</span>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-header-foreground/10 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href!}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                          child.href && isActive(child.href)
                            ? "text-header-foreground bg-header-foreground/10"
                            : "text-header-foreground/60 hover:text-header-foreground hover:bg-header-foreground/10"
                        )}
                      >
                        <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {t(child.labelKey)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive(item.href!)
                  ? "text-header-foreground bg-header-foreground/15 font-medium"
                  : "text-header-foreground/70 hover:text-header-foreground hover:bg-header-foreground/10"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      {userDisplayName?.trim() ? (
        <div className="px-4 py-2.5 border-t border-header-foreground/10">
          <p className="text-header-foreground/90 text-sm text-center font-medium truncate" title={userDisplayName.trim()}>
            {userDisplayName.trim()}
          </p>
        </div>
      ) : null}
      <div className="px-4 py-3 border-t border-header-foreground/10">
        <p className="text-header-foreground/30 text-xs text-center">{t("sidebar.superadminPortal")}</p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Package,
  Building2,
  Users,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Wrench,
  FileStack,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n/context";

interface NavItem {
  labelKey: string;
  href?: string;
  icon: React.ElementType;
  roles?: string[];
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.clients", href: "/clients", icon: Building2 },
  { labelKey: "nav.quotes", href: "/quotes", icon: FileText },
  { labelKey: "nav.engineering", href: "/engineering", icon: Wrench },
  { labelKey: "nav.documents", href: "/documents", icon: FileStack },
  { labelKey: "nav.training", href: "/training", icon: GraduationCap },
  { labelKey: "nav.inventory", href: "/inventory", icon: Package },
  { labelKey: "nav.sales", href: "/sales", icon: ShoppingCart, roles: ["SUPERADMIN"] },
  { labelKey: "nav.reports", href: "/reports", icon: BarChart3, roles: ["SUPERADMIN", "org_admin"] },
  {
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["SUPERADMIN", "org_admin"],
    children: [
      { labelKey: "nav.settings.overview", href: "/settings", icon: Settings },
      { labelKey: "nav.team", href: "/settings/team", icon: Users },
    ],
  },
];

interface SidebarProps {
  role: string;
  /** Shown under the nav (name or email). */
  userDisplayName?: string | null;
}

export function Sidebar({ role, userDisplayName }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>(["nav.settings"]);

  const toggle = (key: string) => {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((l) => l !== key) : [...prev, key]
    );
  };

  const canSee = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="w-64 bg-header flex flex-col h-full shadow-xl flex-shrink-0">
      {/* Logo (horizontal) */}
      <div className="px-3 py-4 border-b border-header-foreground/10 flex items-center">
        <Image
          src="/logo-vbt-white-horizontal.png"
          alt="Vision Building Technologies"
          width={240}
          height={56}
          className="w-full h-11 object-contain object-left"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navigation.filter(canSee).map((item) => {
          if (item.children) {
            const isOpen = expanded.includes(item.labelKey);
            const hasActiveChild = item.children.some(
              (child) => child.href && isActive(child.href)
            );

            return (
              <div key={item.labelKey}>
                <button
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
                    {item.children.filter(canSee).map((child) => (
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

      {/* Footer */}
      <div className="px-4 py-3 border-t border-header-foreground/10">
        <p className="text-header-foreground/30 text-xs text-center">{t("sidebar.footerVersion")}</p>
      </div>
    </div>
  );
}

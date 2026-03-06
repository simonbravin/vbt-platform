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
  Globe,
  Truck,
  BookOpen,
  Warehouse,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
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
  { labelKey: "nav.reports", href: "/reports", icon: BarChart3 },
  {
    labelKey: "nav.inventory",
    href: "/admin/inventory",
    icon: Package,
    roles: ["SUPERADMIN", "ADMIN", "SALES"],
  },
  {
    labelKey: "nav.admin",
    icon: Settings,
    roles: ["SUPERADMIN", "ADMIN"],
    children: [
      { labelKey: "nav.users", href: "/admin/users", icon: Users },
      { labelKey: "nav.catalog", href: "/admin/catalog", icon: BookOpen },
      { labelKey: "nav.warehouses", href: "/admin/warehouses", icon: Warehouse },
      { labelKey: "nav.countries", href: "/admin/countries", icon: Globe },
      { labelKey: "nav.freight", href: "/admin/freight", icon: Truck },
      { labelKey: "nav.taxes", href: "/admin/taxes", icon: TrendingUp },
      { labelKey: "nav.settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  role: string;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>(["nav.admin"]);

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
    <div className="w-64 bg-vbt-blue flex flex-col h-full shadow-xl flex-shrink-0">
      {/* Logo (horizontal) */}
      <div className="px-3 py-4 border-b border-white/10 flex items-center">
        <Image
          src="/logo-vbt-white.png"
          alt="Vision Building Technologies"
          width={220}
          height={48}
          className="w-full h-10 object-contain object-left"
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
                      ? "text-white bg-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/10"
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
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {item.children.filter(canSee).map((child) => (
                      <Link
                        key={child.href}
                        href={child.href!}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                          child.href && isActive(child.href)
                            ? "text-white bg-white/10"
                            : "text-white/60 hover:text-white hover:bg-white/10"
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
                  ? "text-white bg-white/15 font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-white/30 text-xs text-center">
          VBT Cost Calculator v1.0
        </p>
      </div>
    </div>
  );
}

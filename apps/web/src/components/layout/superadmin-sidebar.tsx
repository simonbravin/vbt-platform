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
  UserCheck,
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
  { labelKey: "nav.superadmin.pendingApprovals", href: "/admin/users", icon: UserCheck },
  { labelKey: "nav.superadmin.partners", href: "/superadmin/partners", icon: Building2 },
  { labelKey: "nav.superadmin.analytics", href: "/superadmin/analytics", icon: BarChart3 },
  { labelKey: "nav.superadmin.reports", href: "/superadmin/reports", icon: FileBarChart },
  { labelKey: "nav.superadmin.activity", href: "/superadmin/activity", icon: Activity },
  {
    labelKey: "nav.superadmin.content",
    icon: FileText,
    children: [
      { labelKey: "nav.superadmin.documents", href: "/superadmin/documents", icon: FileText },
      { labelKey: "nav.superadmin.training", href: "/superadmin/training", icon: BookOpen },
    ],
  },
  { labelKey: "nav.superadmin.settings", href: "/superadmin/settings", icon: Settings },
];

export function SuperadminSidebar() {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>(["nav.superadmin.content"]);

  const toggle = (key: string) => {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((l) => l !== key) : [...prev, key]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="w-64 bg-vbt-blue flex flex-col h-full shadow-xl flex-shrink-0">
      <div className="px-3 py-4 border-b border-white/10 flex items-center">
        <Image
          src="/logo-vbt-white-horizontal.png"
          alt="Vision Latam"
          width={240}
          height={56}
          className="w-full h-11 object-contain object-left"
        />
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        <p className="px-3 py-1.5 text-xs font-medium text-white/50 uppercase tracking-wider">
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
                    {item.children.map((child) => (
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
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-white/30 text-xs text-center">Superadmin Portal</p>
      </div>
    </div>
  );
}

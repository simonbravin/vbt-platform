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

/** Partner sidebar order: Inicio → Clientes → Ingeniería → Proyectos → Cotizaciones → Ventas → Inventario → Documentos → Capacitación → Reportes → Configuración */
const navigation: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.clients", href: "/clients", icon: Building2 },
  { labelKey: "nav.engineering", href: "/engineering", icon: Wrench },
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.quotes", href: "/quotes", icon: FileText },
  {
    labelKey: "nav.sales",
    href: "/sales",
    icon: ShoppingCart,
    roles: ["org_admin", "sales_user", "technical_user", "viewer"],
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
      { labelKey: "nav.team", href: "/settings/team", icon: Users },
    ],
  },
];

interface SidebarProps {
  role: string;
  /** Shown under the nav (name or email). */
  userDisplayName?: string | null;
  /** When false, hides Capacitación (module visibility). Defaults true. */
  showTrainingNav?: boolean;
}

export function Sidebar({ role, userDisplayName, showTrainingNav = true }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [expanded, setExpanded] = useState<string[]>([]);

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
    <div className="w-64 bg-header flex flex-col h-full flex-shrink-0 border-r border-header-foreground/15">
      {/* Logo row: h-14 matches TopBar; py-0.5 = minimal vertical margin; image fills remaining height */}
      <div className="box-border h-14 flex-shrink-0 border-b border-header-foreground/15 px-3 py-0.5 flex items-center justify-center">
        <Link
          href="/dashboard"
          className="flex max-h-full w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/35 focus-visible:ring-offset-2 focus-visible:ring-offset-header rounded-sm"
          aria-label={t("nav.dashboard")}
        >
          <Image
            src="/logo-vbt-white-horizontal.png"
            alt=""
            width={240}
            height={56}
            draggable={false}
            className="max-h-[calc(3.5rem-0.25rem)] h-auto w-auto max-w-full object-contain object-center select-none [-webkit-user-drag:none]"
            priority
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navigation
          .filter(canSee)
          .filter((item) => showTrainingNav || item.href !== "/training")
          .map((item) => {
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
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm tracking-wide transition-colors border border-transparent",
                    hasActiveChild
                      ? "text-header-foreground bg-header-foreground/10 border-header-foreground/10"
                      : "text-header-foreground/70 hover:text-header-foreground hover:bg-header-foreground/5"
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
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-header-foreground/20 pl-3">
                    {item.children.filter(canSee).map((child) => (
                      <Link
                        key={child.href}
                        href={child.href!}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors",
                          child.href && isActive(child.href)
                            ? "text-header-foreground bg-header-foreground/10 border border-header-foreground/10"
                            : "text-header-foreground/60 hover:text-header-foreground hover:bg-header-foreground/5"
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
                "flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm tracking-wide transition-colors border border-transparent",
                isActive(item.href!)
                  ? "text-header-foreground bg-header-foreground/12 font-medium border-header-foreground/15"
                  : "text-header-foreground/70 hover:text-header-foreground hover:bg-header-foreground/5"
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

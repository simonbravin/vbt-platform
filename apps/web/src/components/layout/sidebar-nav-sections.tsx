"use client";

import Link from "next/link";
import type { ElementType } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type SidebarNavItem = {
  labelKey: string;
  href: string;
  icon: ElementType;
  roles?: string[];
  /** Only highlight on an exact path match (hub pages with sibling children). */
  activeExact?: boolean;
  /** Paths that belong to a sibling nav item, not this prefix. */
  activeExclude?: string[];
};

export type SidebarNavGroup = {
  labelKey: string | null;
  items: SidebarNavItem[];
};

export function isNavHrefActive(
  pathname: string,
  href: string,
  opts?: { exact?: boolean; exclude?: string[] }
) {
  if (opts?.exclude?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (pathname === href) return true;
  if (opts?.exact) return false;
  return pathname.startsWith(`${href}/`);
}

export function SidebarNavSections({
  groups,
  pathname,
  t,
  isItemVisible,
}: {
  groups: SidebarNavGroup[];
  pathname: string;
  t: (key: string) => string;
  isItemVisible: (item: SidebarNavItem) => boolean;
}) {
  return (
    <>
      {groups.map((group) => {
        const visible = group.items.filter(isItemVisible);
        if (visible.length === 0) return null;
        return (
          <SidebarGroup key={group.labelKey ?? visible[0]!.href}>
            {group.labelKey ? <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel> : null}
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavHrefActive(pathname, item.href, {
                      exact: item.activeExact,
                      exclude: item.activeExclude,
                    })}
                    tooltip={t(item.labelKey)}
                  >
                    <Link href={item.href}>
                      <item.icon className="shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        );
      })}
    </>
  );
}

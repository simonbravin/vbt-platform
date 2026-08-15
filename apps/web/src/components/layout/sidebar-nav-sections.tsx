"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ElementType } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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

const STORAGE_KEY = "vbt-sidebar-nav-open";

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

function readStored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeStored(id: string, open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), [id]: open }));
  } catch {
    /* ignore quota / private mode */
  }
}

function NavItems({
  items,
  pathname,
  t,
}: {
  items: SidebarNavItem[];
  pathname: string;
  t: (key: string) => string;
}) {
  return (
    <SidebarMenu className="gap-0">
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            size="sm"
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
  );
}

function CollapsibleNavGroup({
  groupId,
  label,
  items,
  pathname,
  t,
  iconMode,
}: {
  groupId: string;
  label: string;
  items: SidebarNavItem[];
  pathname: string;
  t: (key: string) => string;
  iconMode: boolean;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = readStored()[groupId];
    if (typeof stored === "boolean") setOpen(stored);
  }, [groupId]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    writeStored(groupId, next);
  }

  if (iconMode) {
    return (
      <SidebarGroup className="px-2 py-0.5">
        <NavItems items={items} pathname={pathname} t={t} />
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/nav-section">
      <SidebarGroup className="px-2 py-0.5">
        <SidebarGroupLabel
          asChild
          className="h-6 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55"
        >
          <CollapsibleTrigger
            className="flex w-full items-center gap-1 outline-none hover:text-sidebar-foreground/80"
            aria-expanded={open}
          >
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <ChevronRight
              className={cn("size-3.5 shrink-0 opacity-70 transition-transform duration-150", open && "rotate-90")}
              aria-hidden
            />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <NavItems items={items} pathname={pathname} t={t} />
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
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
  const { state } = useSidebar();
  const iconMode = state === "collapsed";

  return (
    <>
      {groups.map((group) => {
        const visible = group.items.filter(isItemVisible);
        if (visible.length === 0) return null;
        if (!group.labelKey) {
          return (
            <SidebarGroup key={visible[0]!.href} className="px-2 py-0.5">
              <NavItems items={visible} pathname={pathname} t={t} />
            </SidebarGroup>
          );
        }
        return (
          <CollapsibleNavGroup
            key={group.labelKey}
            groupId={group.labelKey}
            label={t(group.labelKey)}
            items={visible}
            pathname={pathname}
            t={t}
            iconMode={iconMode}
          />
        );
      })}
    </>
  );
}

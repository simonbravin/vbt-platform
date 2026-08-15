"use client";

export function SidebarPortalBadge({ label }: { label: string }) {
  return (
    <p className="px-3 pb-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/45 group-data-[collapsible=icon]/sidebar-wrapper:hidden">
      {label}
    </p>
  );
}

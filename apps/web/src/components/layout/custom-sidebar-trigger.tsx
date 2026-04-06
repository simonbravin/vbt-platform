"use client";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/context";

export function CustomSidebarTrigger() {
  const t = useT();
  return (
    <Tooltip delayDuration={1000}>
      <TooltipTrigger asChild>
        <SidebarTrigger aria-label={t("shell.toggleSidebar")} />
      </TooltipTrigger>
      <TooltipContent className="px-2 py-1" side="right">
        {t("shell.toggleSidebarHint")}{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>b</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}

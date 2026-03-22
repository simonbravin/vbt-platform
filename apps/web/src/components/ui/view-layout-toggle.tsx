"use client";

import { LayoutGrid, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

export type ViewLayoutMode = "table" | "cards";

type ViewLayoutToggleProps = {
  view: ViewLayoutMode;
  onViewChange: (mode: ViewLayoutMode) => void;
  className?: string;
};

const segmentClass =
  "inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors";

export function ViewLayoutToggle({ view, onViewChange, className }: ViewLayoutToggleProps) {
  const t = useT();

  return (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-sm border border-border/60 bg-muted/30 p-0.5 ring-1 ring-border/40",
        className
      )}
      role="group"
      aria-label={t("common.viewLayout.groupAria")}
    >
      <button
        type="button"
        onClick={() => onViewChange("table")}
        aria-pressed={view === "table"}
        title={t("common.viewLayout.tableAria")}
        className={cn(
          segmentClass,
          view === "table"
            ? "bg-background text-foreground ring-1 ring-border/50"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutList className="h-4 w-4 shrink-0" aria-hidden />
        {t("common.viewLayout.table")}
      </button>
      <button
        type="button"
        onClick={() => onViewChange("cards")}
        aria-pressed={view === "cards"}
        title={t("common.viewLayout.cardsAria")}
        className={cn(
          segmentClass,
          view === "cards"
            ? "bg-background text-foreground ring-1 ring-border/50"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        {t("common.viewLayout.cards")}
      </button>
    </div>
  );
}

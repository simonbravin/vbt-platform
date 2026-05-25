"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortableTableHeadProps = {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
  className?: string;
};

export function SortableTableHead({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  align = "left",
  className,
}: SortableTableHeadProps) {
  const active = activeSortKey === sortKey;
  return (
    <th
      className={cn(
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "center" && "justify-center w-full",
          align === "right" && "justify-end w-full"
        )}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}

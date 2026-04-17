"use client";

import type { ReactNode } from "react";
import { Plus, Download, Search } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { PANEL_SYSTEM_CODES } from "@/lib/inventory-stock-group";

type Props = {
  title?: ReactNode;
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  tableSystemCodes: Set<string>;
  exportSystemCodes: Set<string>;
  onToggleTableSystem: (code: string) => void;
  onToggleExportSystem: (code: string) => void;
  onExport: () => void;
  exportDisabled: boolean;
  onAddItem: () => void;
};

function SystemChip({
  code,
  active,
  onClick,
}: {
  code: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums border transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {code}
    </button>
  );
}

export function InventoryStockToolbar({
  title,
  searchFilter,
  onSearchFilterChange,
  tableSystemCodes,
  exportSystemCodes,
  onToggleTableSystem,
  onToggleExportSystem,
  onExport,
  exportDisabled,
  onAddItem,
}: Props) {
  const t = useT();

  return (
    <div className="px-4 py-3 border-b border-border flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:flex-wrap xl:gap-3">
        {title != null && <div className="shrink-0 text-sm font-semibold text-foreground flex items-center gap-2">{title}</div>}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={t("admin.inventory.filterPlaceholder")}
            value={searchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <span className="text-muted-foreground whitespace-nowrap">{t("admin.inventory.systemFilterTable")}</span>
          {PANEL_SYSTEM_CODES.map((code) => (
            <SystemChip
              key={`tbl-${code}`}
              code={code}
              active={tableSystemCodes.has(code)}
              onClick={() => onToggleTableSystem(code)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <span className="text-muted-foreground whitespace-nowrap">{t("admin.inventory.systemFilterCsv")}</span>
          {PANEL_SYSTEM_CODES.map((code) => (
            <SystemChip
              key={`csv-${code}`}
              code={code}
              active={exportSystemCodes.has(code)}
              onClick={() => onToggleExportSystem(code)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          <button
            type="button"
            disabled={exportDisabled}
            onClick={onExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-input bg-background hover:bg-muted disabled:opacity-50 order-1 xl:order-none"
          >
            <Download className="h-4 w-4 shrink-0" />
            {t("admin.inventory.exportStockCsv")}
          </button>
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 order-2 xl:order-none"
          >
            <Plus className="h-4 w-4 shrink-0" /> {t("admin.inventory.addItem")}
          </button>
        </div>
      </div>
    </div>
  );
}

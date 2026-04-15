"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";

type WarehouseOpt = { id: string; name: string };
type TxTypeOpt = { value: string; label: string };

type PreviewAggregated = {
  catalogPieceId: string;
  canonicalName: string;
  systemCode: string;
  quantityFromFile: number;
  quantityDelta: number;
};

type PreviewResponse = {
  dryRun: boolean;
  parseSummary: {
    totalRows: number;
    invalidParseRows: number;
    unmatchedRows: number;
    matchedDataRows: number;
    csvErrors?: string[];
  };
  headerMap?: Record<string, string | null>;
  unmatched: { rowNum: number; rawPieceName: string; rawPieceCode?: string }[];
  aggregated: PreviewAggregated[];
  hasApplyableLines: boolean;
};

type Props = {
  warehouses: WarehouseOpt[];
  txTypes: TxTypeOpt[];
  /** Vision Latam org when superadmin applies VL stock */
  organizationId?: string | null;
  disabled?: boolean;
  defaultMovementType: string;
  onApplied?: () => void;
};

export function InventoryBulkFileImport({
  warehouses,
  txTypes,
  organizationId,
  disabled,
  defaultMovementType,
  onApplied,
}: Props) {
  const t = useT();
  const [warehouseId, setWarehouseId] = useState("");
  const [movementType, setMovementType] = useState(defaultMovementType);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  /** Remount file input after apply so the browser clears the filename (same path re-select fires onChange). */
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    setPreview(null);
  }, [warehouseId, movementType]);

  const postForm = useCallback(
    async (dryRun: boolean) => {
      if (!file || !warehouseId) {
        setError(t("admin.inventory.bulkImport.missingFileOrWarehouse"));
        return null;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("warehouseId", warehouseId);
      fd.append("type", movementType);
      fd.append("dryRun", dryRun ? "true" : "false");
      if (notes.trim()) fd.append("notes", notes.trim());
      if (organizationId) fd.append("organizationId", organizationId);

      const res = await fetch("/api/saas/inventory/bulk-import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : t("admin.inventory.bulkImport.requestFailed"));
      }
      return data;
    },
    [file, warehouseId, movementType, notes, organizationId, t]
  );

  const handlePreview = () => {
    setError(null);
    setPreview(null);
    setLoadingPreview(true);
    postForm(true)
      .then((data) => {
        if (data) setPreview(data as PreviewResponse);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingPreview(false));
  };

  const handleApply = () => {
    if (!preview?.hasApplyableLines) return;
    setError(null);
    setLoadingApply(true);
    postForm(false)
      .then((data) => {
        if (
          !data ||
          data.dryRun === true ||
          typeof (data as { appliedPieces?: unknown }).appliedPieces !== "number"
        ) {
          setError(t("admin.inventory.bulkImport.requestFailed"));
          return;
        }
        setPreview(null);
        setFile(null);
        setFileInputKey((k) => k + 1);
        onApplied?.();
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingApply(false));
  };

  const busy = loadingPreview || loadingApply;

  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Upload className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("admin.inventory.bulkImport.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("admin.inventory.bulkImport.description")}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.warehouse")}</label>
          <FilterSelect
            value={warehouseId}
            onValueChange={setWarehouseId}
            emptyOptionLabel="—"
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            disabled={!!disabled}
            aria-label={t("admin.inventory.warehouse")}
            triggerClassName="h-9 min-w-[160px] max-w-[min(100vw-2rem,260px)] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.labelType")}</label>
          <FilterSelect
            value={movementType}
            onValueChange={setMovementType}
            options={txTypes.map((o) => ({ value: o.value, label: o.label }))}
            disabled={!!disabled}
            aria-label={t("admin.inventory.labelType")}
            triggerClassName="h-9 min-w-[160px] max-w-[min(100vw-2rem,260px)] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.bulkImport.fileLabel")}</label>
          <input
            key={fileInputKey}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            disabled={!!disabled || busy}
            onClick={(e) => {
              (e.currentTarget as HTMLInputElement).value = "";
            }}
            onChange={(e) => {
              setPreview(null);
              setFile(e.target.files?.[0] ?? null);
            }}
            className="block text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs text-muted-foreground mb-1">{t("common.notes")}</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!!disabled || busy}
            placeholder={t("admin.inventory.optional")}
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!!disabled || busy || !file || !warehouseId}
          onClick={handlePreview}
          className="rounded-lg px-3 py-1.5 text-sm font-medium border border-input bg-background hover:bg-muted disabled:opacity-50"
        >
          {loadingPreview ? t("common.loading") : t("admin.inventory.bulkImport.preview")}
        </button>
        <button
          type="button"
          disabled={!!disabled || busy || !preview?.hasApplyableLines}
          onClick={handleApply}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loadingApply ? t("common.saving") : t("admin.inventory.bulkImport.apply")}
        </button>
      </div>

      {preview && (
        <div className="space-y-2 pt-2 border-t border-border text-sm">
          <p className="text-xs text-muted-foreground">
            {t("admin.inventory.bulkImport.summaryLine", {
              total: preview.parseSummary.totalRows,
              invalid: preview.parseSummary.invalidParseRows,
              unmatched: preview.parseSummary.unmatchedRows,
              matched: preview.parseSummary.matchedDataRows,
            })}
          </p>
          {!preview.hasApplyableLines && (
            <p className="text-xs text-destructive">{t("admin.inventory.bulkImport.nothingToApply")}</p>
          )}
          {preview.aggregated.length > 0 && (
            <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-md border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">{t("admin.inventory.piece")}</th>
                    <th className="text-left px-2 py-1 font-medium">{t("admin.inventory.system")}</th>
                    <th className="text-right px-2 py-1 font-medium">{t("admin.inventory.bulkImport.colQtyFile")}</th>
                    <th className="text-right px-2 py-1 font-medium">{t("admin.inventory.bulkImport.colDelta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.aggregated.map((row) => (
                    <tr key={row.catalogPieceId} className="border-t border-border/60">
                      <td className="px-2 py-1">{row.canonicalName}</td>
                      <td className="px-2 py-1 text-muted-foreground">{row.systemCode}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.quantityFromFile}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium">
                        {row.quantityDelta >= 0 ? "+" : ""}
                        {row.quantityDelta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.unmatched.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {t("admin.inventory.bulkImport.unmatchedToggle", {
                  count: preview.parseSummary.unmatchedRows,
                })}
              </summary>
              <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto pl-3 list-disc text-muted-foreground">
                {preview.unmatched.map((u) => (
                  <li key={`${u.rowNum}-${u.rawPieceName}`}>
                    {t("admin.inventory.bulkImport.unmatchedRow", {
                      row: u.rowNum,
                      name: u.rawPieceName,
                      code: u.rawPieceCode ?? "—",
                    })}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

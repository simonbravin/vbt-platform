"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Warehouse, Package, Settings, Pencil, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { FilterSelect } from "@/components/ui/filter-select";
import { InventoryBulkFileImport } from "@/components/inventory/InventoryBulkFileImport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadInventoryLevelsCsv } from "@/lib/inventory-csv-export";
import {
  PANEL_SYSTEM_CODES,
  groupStockByWarehouseAndPiece,
  sumQuantities,
  distinctLengthMmSorted,
  toggleSystemInSet,
} from "@/lib/inventory-stock-group";
import { InventoryStockToolbar } from "@/components/inventory/InventoryStockToolbar";

const LEVELS_FETCH_LIMIT = 5000;

type WarehouseRow = { id: string; name: string; location: string | null; countryCode?: string | null; address?: string | null; managerName?: string | null; contactPhone?: string | null; contactEmail?: string | null; isActive: boolean };
type LevelRow = {
  id: string;
  quantity: number;
  lengthMm: number;
  unit: string | null;
  warehouse: { id: string; name: string };
  catalogPiece: { id: string; canonicalName: string; systemCode: string };
};
type CatalogPieceRow = { id: string; canonicalName: string; systemCode: string };
type TxRow = {
  id: string;
  quantityDelta: number;
  lengthMm?: number;
  type: string;
  createdAt: string;
  warehouse: { name: string };
  catalogPiece: { canonicalName: string; systemCode: string };
};

const TX_TYPE_VALUES = [
  "purchase_in",
  "project_surplus",
  "adjustment_in",
  "sale_out",
  "project_consumption",
  "adjustment_out",
] as const;

/** Movement types that add stock when quantity is entered as a positive number in the form. */
const STOCK_IN_TYPES = new Set<string>(["purchase_in", "project_surplus", "adjustment_in"]);

export function InventoryClient() {
  const t = useT();
  const txTypes = useMemo(
    () =>
      TX_TYPE_VALUES.map((value) => ({
        value,
        label: t(`admin.inventory.txType.${value}`),
      })),
    [t]
  );
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [catalogPieces, setCatalogPieces] = useState<CatalogPieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [txForm, setTxForm] = useState({
    warehouseId: "",
    catalogPieceId: "",
    quantityDelta: 0,
    type: "purchase_in",
    notes: "",
    referenceProjectId: "",
    lengthMmStr: "",
  });
  const [txSaving, setTxSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [adjustLevel, setAdjustLevel] = useState<LevelRow | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustDirection, setAdjustDirection] = useState<"in" | "out">("in");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [tableSystemCodes, setTableSystemCodes] = useState<Set<string>>(() => new Set(PANEL_SYSTEM_CODES));
  const [exportSystemCodes, setExportSystemCodes] = useState<Set<string>>(() => new Set(PANEL_SYSTEM_CODES));
  const [expandedStockGroups, setExpandedStockGroups] = useState<Set<string>>(() => new Set());
  const [pruneBusy, setPruneBusy] = useState(false);
  const [pruneMessage, setPruneMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/saas/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []))
      .catch(() => setWarehouses([]))
      .finally(() => setLoading(false));
  }, []);

  const loadLevels = useCallback(() => {
    setLoadingLevels(true);
    fetch(`/api/saas/inventory/levels?limit=${LEVELS_FETCH_LIMIT}`)
      .then((r) => r.json())
      .then((data) => setLevels(data.levels ?? []))
      .catch(() => setLevels([]))
      .finally(() => setLoadingLevels(false));
  }, []);

  const loadTransactions = useCallback(() => {
    fetch("/api/saas/inventory/transactions?limit=50")
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => setCatalogPieces(Array.isArray(data) ? data : []))
      .catch(() => setCatalogPieces([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      loadLevels();
      loadTransactions();
    }
  }, [loading, loadLevels, loadTransactions]);

  const handleCreateTransaction = () => {
    if (!txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0) return;
    const delta = ["sale_out", "project_consumption", "adjustment_out"].includes(txForm.type)
      ? -Math.abs(txForm.quantityDelta)
      : Math.abs(txForm.quantityDelta);
    const lmTrim = txForm.lengthMmStr.trim();
    const isInbound = STOCK_IN_TYPES.has(txForm.type) && delta > 0;
    if (isInbound && lmTrim === "") {
      setError(t("partner.inventory.measureRequired"));
      return;
    }
    const lengthMmParsed = lmTrim === "" ? undefined : Number(lmTrim);
    const lengthMm =
      lengthMmParsed !== undefined && Number.isFinite(lengthMmParsed) ? Math.round(lengthMmParsed) : undefined;
    setTxSaving(true);
    setError(null);
    fetch("/api/saas/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: txForm.warehouseId,
        catalogPieceId: txForm.catalogPieceId,
        quantityDelta: delta,
        type: txForm.type,
        ...(lengthMm !== undefined ? { lengthMm } : {}),
        notes: txForm.notes || undefined,
        referenceProjectId: txForm.referenceProjectId.trim() || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error ?? "Error"); });
        return r.json();
      })
      .then(() => {
        setTxForm((f) => ({ ...f, quantityDelta: 0, notes: "", referenceProjectId: "", lengthMmStr: "" }));
        setAddItemDialogOpen(false);
        loadLevels();
        loadTransactions();
      })
      .catch((e) => setError(e.message ?? t("admin.inventory.errorCreateTransaction")))
      .finally(() => setTxSaving(false));
  };

  const handleAdjustLineSubmit = () => {
    if (!adjustLevel || adjustQty <= 0) return;
    const type = adjustDirection === "in" ? "adjustment_in" : "adjustment_out";
    const delta = adjustDirection === "in" ? Math.abs(adjustQty) : -Math.abs(adjustQty);
    const lengthMm = Math.round(Number(adjustLevel.lengthMm ?? 0));
    setAdjustSaving(true);
    setAdjustError(null);
    fetch("/api/saas/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: adjustLevel.warehouse.id,
        catalogPieceId: adjustLevel.catalogPiece.id,
        quantityDelta: delta,
        type,
        lengthMm,
        notes: adjustNotes.trim() || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error ?? "Error"); });
        return r.json();
      })
      .then(() => {
        setAdjustLevel(null);
        setAdjustQty(0);
        setAdjustNotes("");
        loadLevels();
        loadTransactions();
      })
      .catch((e) =>
        setAdjustError(
          t("admin.inventory.apiError", {
            message: e.message || t("admin.inventory.errorTransactionFallback"),
          })
        )
      )
      .finally(() => setAdjustSaving(false));
  };

  const searchFilteredLevels = useMemo(() => {
    if (!searchFilter.trim()) return levels;
    const q = searchFilter.trim().toLowerCase();
    return levels.filter(
      (l) =>
        l.warehouse.name.toLowerCase().includes(q) ||
        (l.catalogPiece?.canonicalName ?? "").toLowerCase().includes(q) ||
        (l.catalogPiece?.systemCode ?? "").toLowerCase().includes(q) ||
        String(l.lengthMm ?? 0).includes(q)
    );
  }, [levels, searchFilter]);

  const normSystem = (code: string | undefined | null) => String(code ?? "").trim().toUpperCase();

  const displayLevels = useMemo(
    () =>
      searchFilteredLevels.filter((l) => {
        const code = normSystem(l.catalogPiece.systemCode);
        if ((PANEL_SYSTEM_CODES as readonly string[]).includes(code)) return tableSystemCodes.has(code);
        return true;
      }),
    [searchFilteredLevels, tableSystemCodes]
  );

  const exportLevels = useMemo(
    () =>
      searchFilteredLevels.filter((l) => {
        const code = normSystem(l.catalogPiece.systemCode);
        if ((PANEL_SYSTEM_CODES as readonly string[]).includes(code)) return exportSystemCodes.has(code);
        return true;
      }),
    [searchFilteredLevels, exportSystemCodes]
  );

  const stockGroups = useMemo(() => groupStockByWarehouseAndPiece(displayLevels), [displayLevels]);

  const toggleStockGroup = (key: string) => {
    setExpandedStockGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showLegacyMeasureBanner = useMemo(
    () => levels.some((l) => Number(l.quantity) > 0 && Math.round(Number(l.lengthMm ?? 0)) === 0),
    [levels]
  );

  const handlePruneZeroLevels = async () => {
    if (!window.confirm(t("admin.inventory.pruneZeroConfirm"))) return;
    setPruneBusy(true);
    setPruneMessage(null);
    setError(null);
    try {
      const r = await fetch("/api/saas/inventory/prune-zero-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "prune");
      setPruneMessage(t("admin.inventory.pruneZeroSuccess", { count: Number(data.deleted) || 0 }));
      loadLevels();
    } catch {
      setError(t("admin.inventory.pruneZeroError"));
    } finally {
      setPruneBusy(false);
    }
  };

  const lowStockThresholdRaw = process.env.NEXT_PUBLIC_INVENTORY_LOW_STOCK_THRESHOLD;
  const lowStockThreshold =
    lowStockThresholdRaw != null && String(lowStockThresholdRaw).trim() !== ""
      ? Number(lowStockThresholdRaw)
      : NaN;
  const lowStockLevels = useMemo(() => {
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold <= 0) return [];
    return levels.filter((l) => l.quantity < lowStockThreshold);
  }, [levels, lowStockThreshold]);

  if (loading) {
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-alert-warningBorder bg-alert-warning px-4 py-2 text-sm text-foreground">
          {error}
        </div>
      )}
      {lowStockLevels.length > 0 && (
        <div className="rounded-lg border border-alert-warningBorder bg-alert-warning px-4 py-3 text-sm text-foreground">
          {t("partner.inventory.lowStockBanner", {
            count: lowStockLevels.length,
            threshold: lowStockThreshold,
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-prose">
          {t("partner.inventory.warehousesSectionHint")}
        </p>
        <Link
          href="/settings/warehouses"
          className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Settings className="w-4 h-4" /> {t("partner.settings.configureWarehouses")}
        </Link>
      </div>
      <div className="surface-card-overflow">
        {warehouses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Warehouse className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">
              {t("common.noData")} {t("partner.settings.warehouses").toLowerCase()}.
            </p>
            <p className="text-sm mt-1">
              <Link href="/settings/warehouses" className="text-primary hover:underline">
                {t("partner.settings.configureWarehouses")}
              </Link>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {warehouses.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{w.name}</p>
                  {w.location && <p className="text-xs text-muted-foreground">{w.location}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <InventoryBulkFileImport
        warehouses={warehouses}
        txTypes={txTypes}
        defaultMovementType="purchase_in"
        disabled={warehouses.length === 0}
        onApplied={() => {
          loadLevels();
          loadTransactions();
        }}
      />

      <div className="surface-card-overflow">
        <InventoryStockToolbar
          title={
            <>
              <Package className="h-4 w-4 shrink-0" /> {t("admin.inventory.stockByWarehouse")}
            </>
          }
          searchFilter={searchFilter}
          onSearchFilterChange={setSearchFilter}
          tableSystemCodes={tableSystemCodes}
          exportSystemCodes={exportSystemCodes}
          onToggleTableSystem={(code) => setTableSystemCodes((prev) => toggleSystemInSet(prev, code))}
          onToggleExportSystem={(code) => setExportSystemCodes((prev) => toggleSystemInSet(prev, code))}
          exportDisabled={exportLevels.length === 0}
          onExport={() => {
            downloadInventoryLevelsCsv(
              exportLevels.map((l) => ({
                warehouseName: l.warehouse.name,
                pieceName: l.catalogPiece.canonicalName,
                systemCode: l.catalogPiece.systemCode,
                lengthMm: l.lengthMm,
                quantity: l.quantity,
                unit: l.unit ?? "",
              })),
              "inventory-stock"
            );
          }}
          onAddItem={() => {
            setError(null);
            setAddItemDialogOpen(true);
          }}
        />
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground max-w-prose">{t("admin.inventory.pruneZeroHelp")}</p>
          <button
            type="button"
            disabled={pruneBusy}
            onClick={handlePruneZeroLevels}
            className="inline-flex shrink-0 items-center gap-2 self-start sm:self-auto rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {pruneBusy ? t("common.loading") : t("admin.inventory.pruneZeroButton")}
          </button>
        </div>
        {pruneMessage && (
          <div className="px-4 py-2 border-b border-border bg-emerald-500/10 text-sm text-foreground">{pruneMessage}</div>
        )}
        {showLegacyMeasureBanner && (
          <div className="px-4 py-2 border-b border-border bg-muted/40 text-sm text-foreground">
            {t("admin.inventory.legacyMeasureBanner")}
          </div>
        )}
        {loadingLevels ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 px-2 py-2" aria-hidden />
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.warehouse")}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.piece")}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.system")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase whitespace-nowrap min-w-[7rem]">
                    {t("partner.inventory.measureMmColumn")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.quantityColumn")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase w-[1%] whitespace-nowrap">
                    {t("admin.inventory.actionsColumn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {stockGroups.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {levels.length === 0
                        ? t("admin.inventory.noItemsAddOne")
                        : t("admin.inventory.filteredEmpty")}
                    </td>
                  </tr>
                ) : (
                  stockGroups.flatMap((g) => {
                    const expanded = expandedStockGroups.has(g.key);
                    const lengths = distinctLengthMmSorted(g.lines);
                    const totalQty = sumQuantities(g.lines);
                    const measureSummary =
                      lengths.length <= 1
                        ? String(lengths[0] ?? 0)
                        : t("admin.inventory.groupMeasureCount", { count: lengths.length });
                    const measureTitle =
                      lengths.length > 1 ? lengths.map((m) => `${m} mm`).join(", ") : undefined;
                    const summaryRow = (
                      <tr
                        key={`g-${g.key}`}
                        className="bg-muted/25 hover:bg-muted/40 cursor-pointer"
                        onClick={() => toggleStockGroup(g.key)}
                      >
                        <td className="px-2 py-2 text-center text-muted-foreground w-10">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-transparent">
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            )}
                          </span>
                          <span className="sr-only">
                            {expanded ? t("admin.inventory.groupCollapseRow") : t("admin.inventory.groupExpandRow")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-foreground">{g.warehouse.name}</td>
                        <td className="px-4 py-2 text-sm font-medium text-foreground">{g.catalogPiece.canonicalName}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{g.catalogPiece.systemCode}</td>
                        <td
                          className="px-4 py-2 text-sm text-right tabular-nums text-muted-foreground"
                          title={measureTitle}
                        >
                          {measureSummary}
                        </td>
                        <td className="px-4 py-2 text-sm text-right tabular-nums font-medium text-foreground">{totalQty}</td>
                        <td className="px-4 py-2 text-sm text-right text-muted-foreground">—</td>
                      </tr>
                    );
                    if (!expanded) return [summaryRow];
                    const detailRows = g.lines.map((l) => {
                      const mm = Math.round(Number(l.lengthMm ?? 0));
                      return (
                        <tr key={l.id} className="bg-card hover:bg-muted/20">
                          <td className="w-10 px-2 py-2" />
                          <td className="px-4 py-2 text-sm text-muted-foreground pl-6 border-l-2 border-primary/30">
                            {l.warehouse.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{l.catalogPiece.canonicalName}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{l.catalogPiece.systemCode}</td>
                          <td
                            className="px-4 py-2 text-sm text-right tabular-nums text-muted-foreground"
                            title={mm === 0 ? t("partner.inventory.measureZeroTooltip") : undefined}
                          >
                            {mm}
                          </td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums text-foreground">{l.quantity}</td>
                          <td className="px-4 py-2 text-sm text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAdjustError(null);
                                setAdjustLevel(l);
                                setAdjustQty(0);
                                setAdjustNotes("");
                                setAdjustDirection("in");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span>{t("admin.inventory.actionAdjust")}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    });
                    return [summaryRow, ...detailRows];
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <div className="surface-card p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">{t("admin.inventory.recentMovements")}</h4>
          <ul className="space-y-1 text-sm">
            {transactions.slice(0, 10).map((tx) => {
              const txMm = Math.round(Number(tx.lengthMm ?? 0));
              return (
                <li key={tx.id} className="flex flex-wrap gap-2 text-foreground">
                  <span className="font-medium">{tx.warehouse.name}</span>
                  <span>{tx.catalogPiece.canonicalName}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    @{txMm} mm
                  </span>
                  <span className={tx.quantityDelta >= 0 ? "text-primary" : "text-destructive"}>
                    {tx.quantityDelta >= 0 ? "+" : ""}
                    {tx.quantityDelta}
                  </span>
                  <span className="text-muted-foreground text-xs">{tx.type}</span>
                  <span className="text-muted-foreground text-xs">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog
        open={addItemDialogOpen}
        onOpenChange={(open) => {
          setAddItemDialogOpen(open);
          if (!open) {
            setError(null);
            setTxForm((f) => ({ ...f, quantityDelta: 0, notes: "", referenceProjectId: "", lengthMmStr: "" }));
          }
        }}
      >
        <DialogContent className="w-[min(100vw-2rem,52rem)] max-w-none sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{t("partner.inventory.addItemDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("partner.inventory.addItemDialogDescription")} {t("admin.inventory.txFormHelpPartner")}{" "}
              {t("admin.inventory.lengthMmFormHelp")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.warehouse")}</label>
              <FilterSelect
                value={txForm.warehouseId}
                onValueChange={(v) => setTxForm((f) => ({ ...f, warehouseId: v }))}
                emptyOptionLabel="—"
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                aria-label={t("admin.inventory.warehouse")}
                triggerClassName="w-full h-10 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.piece")}</label>
              <FilterSelect
                value={txForm.catalogPieceId}
                onValueChange={(v) => setTxForm((f) => ({ ...f, catalogPieceId: v }))}
                emptyOptionLabel="—"
                options={catalogPieces.map((p) => ({
                  value: p.id,
                  label: `${p.canonicalName} (${p.systemCode})`,
                }))}
                aria-label={t("admin.inventory.piece")}
                triggerClassName="w-full h-10 text-sm max-w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.labelType")}</label>
              <FilterSelect
                value={txForm.type}
                onValueChange={(v) => setTxForm((f) => ({ ...f, type: v }))}
                options={txTypes}
                aria-label={t("admin.inventory.labelType")}
                triggerClassName="w-full h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.labelQuantity")}</label>
              <input
                type="number"
                min={0}
                step="any"
                value={txForm.quantityDelta || ""}
                onChange={(e) => setTxForm((f) => ({ ...f, quantityDelta: Number(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.lengthMmFormLabel")}</label>
              <input
                type="text"
                inputMode="numeric"
                value={txForm.lengthMmStr}
                onChange={(e) => setTxForm((f) => ({ ...f, lengthMmStr: e.target.value }))}
                placeholder={t("admin.inventory.lengthMmFormPlaceholder")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums"
                aria-required={STOCK_IN_TYPES.has(txForm.type)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.referenceProjectId")}</label>
              <input
                type="text"
                value={txForm.referenceProjectId}
                onChange={(e) => setTxForm((f) => ({ ...f, referenceProjectId: e.target.value }))}
                placeholder={t("admin.inventory.optional")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t("common.notes")}</label>
              <input
                type="text"
                value={txForm.notes}
                onChange={(e) => setTxForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("admin.inventory.optional")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setAddItemDialogOpen(false)}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreateTransaction}
              disabled={txSaving || !txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {txSaving ? t("common.saving") : t("admin.inventory.apply")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustLevel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustLevel(null);
            setAdjustError(null);
            setAdjustQty(0);
            setAdjustNotes("");
          }
        }}
      >
        <DialogContent className="w-[min(100vw-2rem,40rem)] max-w-none sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{t("admin.inventory.adjustLineTitle")}</DialogTitle>
            <DialogDescription>{t("admin.inventory.adjustLineDescription")}</DialogDescription>
          </DialogHeader>
          {adjustLevel && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-1">
                <p>
                  <span className="text-muted-foreground">{t("admin.inventory.warehouse")}: </span>
                  {adjustLevel.warehouse.name}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("admin.inventory.piece")}: </span>
                  {adjustLevel.catalogPiece.canonicalName}{" "}
                  <span className="text-muted-foreground">({adjustLevel.catalogPiece.systemCode})</span>
                </p>
                <p className="tabular-nums">
                  <span className="text-muted-foreground">{t("partner.inventory.measureMmColumn")}: </span>
                  {Math.round(Number(adjustLevel.lengthMm ?? 0))} mm ·{" "}
                  <span className="text-muted-foreground">{t("admin.inventory.quantityColumn")}: </span>
                  {adjustLevel.quantity}
                </p>
              </div>
              {adjustError && (
                <div className="rounded-lg border border-alert-warningBorder bg-alert-warning px-3 py-2 text-sm text-foreground">
                  {adjustError}
                </div>
              )}
              <fieldset className="space-y-2">
                <legend className="text-xs text-muted-foreground mb-1">{t("admin.inventory.adjustDirection")}</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="partner-adjust-dir"
                      checked={adjustDirection === "in"}
                      onChange={() => setAdjustDirection("in")}
                      className="rounded-full border-input"
                    />
                    {t("admin.inventory.adjustIn")}
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="partner-adjust-dir"
                      checked={adjustDirection === "out"}
                      onChange={() => setAdjustDirection("out")}
                      className="rounded-full border-input"
                    />
                    {t("admin.inventory.adjustOut")}
                  </label>
                </div>
              </fieldset>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("admin.inventory.labelQuantity")}</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={adjustQty || ""}
                  onChange={(e) => setAdjustQty(Number(e.target.value) || 0)}
                  className="w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("common.notes")}</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder={t("admin.inventory.optional")}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setAdjustLevel(null)}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdjustLineSubmit}
              disabled={adjustSaving || !adjustLevel || adjustQty <= 0}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {adjustSaving ? t("common.saving") : t("admin.inventory.apply")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

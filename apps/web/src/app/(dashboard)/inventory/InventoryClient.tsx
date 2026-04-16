"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Warehouse, Plus, Package, Search, Settings } from "lucide-react";
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
    fetch("/api/saas/inventory/levels?limit=500")
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

  const filteredLevels = useMemo(() => {
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
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4" /> {t("admin.inventory.stockByWarehouse")}
          </h3>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("admin.inventory.filterPlaceholder")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAddItemDialogOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t("admin.inventory.addItem")}
          </button>
        </div>
        {loadingLevels ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredLevels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {levels.length === 0
                        ? t("admin.inventory.noItemsAddOne")
                        : t("admin.inventory.filteredEmpty")}
                    </td>
                  </tr>
                ) : (
                  filteredLevels.map((l) => {
                    const mm = Math.round(Number(l.lengthMm ?? 0));
                    return (
                      <tr key={l.id}>
                        <td className="px-4 py-2 text-sm text-foreground">{l.warehouse.name}</td>
                        <td className="px-4 py-2 text-sm text-foreground">{l.catalogPiece.canonicalName}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{l.catalogPiece.systemCode}</td>
                        <td
                          className="px-4 py-2 text-sm text-right tabular-nums text-muted-foreground"
                          title={mm === 0 ? t("partner.inventory.measureZeroTooltip") : undefined}
                        >
                          {mm}
                        </td>
                        <td className="px-4 py-2 text-sm text-right tabular-nums text-foreground">{l.quantity}</td>
                      </tr>
                    );
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
        <DialogContent className="sm:max-w-md">
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
    </div>
  );
}

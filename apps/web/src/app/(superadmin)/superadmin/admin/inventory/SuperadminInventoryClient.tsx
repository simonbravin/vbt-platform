"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Package, Plus, Calculator, ArrowDownToLine, Search, Pencil, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
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

type Org = { id: string; name: string };
type WarehouseRow = { id: string; name: string; location: string | null; isActive: boolean };
type LevelRow = {
  id: string;
  quantity: number;
  lengthMm: number;
  unit: string | null;
  warehouse: { id: string; name: string };
  catalogPiece: { id: string; canonicalName: string; systemCode: string };
};
type CatalogPieceRow = { id: string; canonicalName: string; systemCode: string };

const SUPERADMIN_TX_ORDER = [
  "purchase_in",
  "adjustment_in",
  "sale_out",
  "adjustment_out",
  "project_consumption",
  "project_surplus",
] as const;

const SUPERADMIN_STOCK_IN_TYPES = new Set<string>(["purchase_in", "adjustment_in", "project_surplus"]);

export function SuperadminInventoryClient() {
  const t = useT();
  const txTypes = useMemo(
    () =>
      SUPERADMIN_TX_ORDER.map((value) => ({
        value,
        label: t(`admin.inventory.txType.${value}`),
      })),
    [t]
  );
  const [visionLatamOrg, setVisionLatamOrg] = useState<Org | null>(null);
  const [partnerOrgs, setPartnerOrgs] = useState<Org[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState("");
  const [partnerDropdownOpen, setPartnerDropdownOpen] = useState(false);
  const [partnerLevels, setPartnerLevels] = useState<{ organizationId: string; levels: LevelRow[] }[]>([]);
  const [loadingPartnerLevels, setLoadingPartnerLevels] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [catalogPieces, setCatalogPieces] = useState<CatalogPieceRow[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [simulateQuoteId, setSimulateQuoteId] = useState("");
  const [simulateResult, setSimulateResult] = useState<{ required: { pieceName: string; systemCode: string; quantity: number }[]; byWarehouse: { warehouseName: string; organizationName: string; levels: { pieceName: string; onHand: number; required: number; surplus: number; shortage: number }[] }[] } | null>(null);
  const [affectQuoteId, setAffectQuoteId] = useState("");
  const [affectResult, setAffectResult] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({
    warehouseId: "",
    catalogPieceId: "",
    quantityDelta: 0,
    type: "adjustment_in" as string,
    notes: "",
    lengthMmStr: "",
  });
  const [txSaving, setTxSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [txDialogError, setTxDialogError] = useState<string | null>(null);
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

  const vlOrgId = visionLatamOrg?.id ?? "";

  const loadOrgs = useCallback(() => {
    setLoadingOrgs(true);
    Promise.all([
      fetch("/api/saas/partners?limit=200").then((r) => r.json()),
      fetch("/api/saas/inventory/vision-latam-org").then((r) => r.json()),
    ])
      .then(([partnersData, vlData]) => {
        const partners = (partnersData.partners ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name ?? "—" })).filter((o: Org) => o.id);
        const vl = vlData.organization ? { id: vlData.organization.id, name: vlData.organization.name } : null;
        if (vl) setVisionLatamOrg(vl);
        setPartnerOrgs(partners);
      })
      .catch(() => setPartnerOrgs([]))
      .finally(() => setLoadingOrgs(false));
  }, []);

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (!vlOrgId) {
      setWarehouses([]);
      setLevels([]);
      return;
    }
    setLoadingWarehouses(true);
    setLoadingLevels(true);
    fetch(`/api/saas/warehouses?organizationId=${encodeURIComponent(vlOrgId)}`)
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []))
      .catch(() => setWarehouses([]))
      .finally(() => setLoadingWarehouses(false));
    fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=${LEVELS_FETCH_LIMIT}`)
      .then((r) => (r.ok ? r.json() : { levels: [] }))
      .then((data) => setLevels(data.levels ?? []))
      .catch(() => setLevels([]))
      .finally(() => setLoadingLevels(false));
  }, [vlOrgId]);

  useEffect(() => {
    if (selectedPartnerIds.length === 0) {
      setPartnerLevels([]);
      return;
    }
    setLoadingPartnerLevels(true);
    const ids = [...selectedPartnerIds];
    Promise.all(
      ids.map((organizationId) =>
        fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(organizationId)}&limit=${LEVELS_FETCH_LIMIT}`)
          .then((r) => (r.ok ? r.json() : { levels: [] }))
          .then((data) => ({ organizationId, levels: data.levels ?? [] }))
      )
    )
      .then((results) => setPartnerLevels(results))
      .catch(() => setPartnerLevels([]))
      .finally(() => setLoadingPartnerLevels(false));
  }, [selectedPartnerIds.join(",")]);

  useEffect(() => {
    if (vlOrgId) {
      fetch("/api/catalog")
        .then((r) => r.json())
        .then((data) => setCatalogPieces(Array.isArray(data) ? data : []))
        .catch(() => setCatalogPieces([]));
    }
  }, [vlOrgId]);

  const handleSimulate = () => {
    if (!simulateQuoteId.trim()) return;
    setSimulateResult(null);
    fetch(`/api/saas/inventory/simulate?quoteId=${encodeURIComponent(simulateQuoteId.trim())}`)
      .then((r) => r.json())
      .then((data) => setSimulateResult(data))
      .catch(() => setSimulateResult(null));
  };

  const handleAffect = () => {
    if (!affectQuoteId.trim()) return;
    setAffectResult(null);
    setTxSaving(true);
    fetch("/api/saas/inventory/affect-by-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: affectQuoteId.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setAffectResult(t("admin.inventory.apiError", { message: String(data.error) }));
        else setAffectResult(t("admin.inventory.transactionsCreated", { count: Number(data.created) || 0 }));
        if (data.created > 0)
          fetch(
            `/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=${LEVELS_FETCH_LIMIT}`
          )
            .then((res) => res.json())
            .then((d) => setLevels(d.levels ?? []));
      })
      .catch(() => setAffectResult(t("admin.inventory.affectInventoryError")))
      .finally(() => setTxSaving(false));
  };

  const handleCreateTransaction = () => {
    if (!txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0) return;
    const delta = txForm.type.includes("out") || txForm.type === "sale_out" || txForm.type === "project_consumption" ? -Math.abs(txForm.quantityDelta) : Math.abs(txForm.quantityDelta);
    const lmTrim = txForm.lengthMmStr.trim();
    const isInbound = SUPERADMIN_STOCK_IN_TYPES.has(txForm.type) && delta > 0;
    if (isInbound && lmTrim === "") {
      setTxDialogError(t("admin.inventory.measureRequired"));
      return;
    }
    const lengthMmParsed = lmTrim === "" ? undefined : Number(lmTrim);
    const lengthMm =
      lengthMmParsed !== undefined && Number.isFinite(lengthMmParsed) ? Math.round(lengthMmParsed) : undefined;
    setTxSaving(true);
    setTxDialogError(null);
    fetch("/api/saas/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: txForm.warehouseId,
        catalogPieceId: txForm.catalogPieceId,
        quantityDelta: delta,
        type: txForm.type,
        organizationId: vlOrgId,
        ...(lengthMm !== undefined ? { lengthMm } : {}),
        notes: txForm.notes || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error ?? "Error"); });
        return r.json();
      })
      .then(() => {
        setTxForm((f) => ({ ...f, quantityDelta: 0, notes: "", lengthMmStr: "" }));
        setAddItemDialogOpen(false);
        setTxDialogError(null);
        fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=${LEVELS_FETCH_LIMIT}`)
          .then((res) => res.json())
          .then((d) => setLevels(d.levels ?? []));
      })
      .catch((e) =>
        setTxDialogError(
          t("admin.inventory.apiError", {
            message: e.message || t("admin.inventory.errorTransactionFallback"),
          })
        )
      )
      .finally(() => setTxSaving(false));
  };

  const handleAdjustLineSubmit = () => {
    if (!adjustLevel || !vlOrgId || adjustQty <= 0) return;
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
        organizationId: vlOrgId,
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
        fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=${LEVELS_FETCH_LIMIT}`)
          .then((res) => res.json())
          .then((d) => setLevels(d.levels ?? []));
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

  const togglePartnerFilter = (id: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const searchFilteredLevels = useMemo(() => {
    if (!searchFilter.trim()) return levels;
    const q = searchFilter.trim().toLowerCase();
    return levels.filter(
      (l) =>
        l.warehouse.name.toLowerCase().includes(q) ||
        (l.catalogPiece.canonicalName ?? "").toLowerCase().includes(q) ||
        (l.catalogPiece.systemCode ?? "").toLowerCase().includes(q) ||
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

  const reloadVlLevels = useCallback(() => {
    if (!vlOrgId) return;
    fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=${LEVELS_FETCH_LIMIT}`)
      .then((r) => (r.ok ? r.json() : { levels: [] }))
      .then((d) => setLevels(d.levels ?? []));
  }, [vlOrgId]);

  const handlePruneZeroLevels = async () => {
    if (!vlOrgId) return;
    if (!window.confirm(t("admin.inventory.pruneZeroConfirm"))) return;
    setPruneBusy(true);
    setPruneMessage(null);
    setAffectResult(null);
    try {
      const r = await fetch("/api/saas/inventory/prune-zero-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: vlOrgId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "prune");
      setPruneMessage(t("admin.inventory.pruneZeroSuccess", { count: Number(data.deleted) || 0 }));
      reloadVlLevels();
    } catch {
      setAffectResult(t("admin.inventory.pruneZeroError"));
    } finally {
      setPruneBusy(false);
    }
  };

  const showLegacyMeasureBanner = useMemo(
    () => levels.some((l) => Number(l.quantity) > 0 && Math.round(Number(l.lengthMm ?? 0)) === 0),
    [levels]
  );

  const filteredPartnersForDropdown = useMemo(() => {
    if (!partnerSearchQuery.trim()) return partnerOrgs;
    const q = partnerSearchQuery.trim().toLowerCase();
    return partnerOrgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [partnerOrgs, partnerSearchQuery]);

  if (loadingOrgs) {
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!visionLatamOrg) {
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">
        {t("admin.inventory.vlOrgNotFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {partnerOrgs.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground mb-2">{t("admin.inventory.viewPartnerInventoryHint")}</p>
          <div className="relative max-w-md">
            <button
              type="button"
              onClick={() => setPartnerDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm text-left"
            >
              <span className="text-muted-foreground">
                {selectedPartnerIds.length === 0
                  ? t("admin.inventory.selectPartnersPlaceholder")
                  : t("admin.inventory.partnersSelected", { count: selectedPartnerIds.length })}
              </span>
              <span className="text-muted-foreground">{partnerDropdownOpen ? "▲" : "▼"}</span>
            </button>
            {partnerDropdownOpen && (
              <div className="absolute z-10 mt-1 flex max-h-64 w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-popover shadow-none">
                <div className="p-2 border-b border-border relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t("admin.inventory.searchPartnerPlaceholder")}
                    value={partnerSearchQuery}
                    onChange={(e) => setPartnerSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
                <div className="overflow-y-auto p-2">
                  {filteredPartnersForDropdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">{t("admin.inventory.noResults")}</p>
                  ) : (
                    filteredPartnersForDropdown.map((org) => (
                      <label
                        key={org.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPartnerIds.includes(org.id)}
                          onChange={() => togglePartnerFilter(org.id)}
                          className="rounded-lg border-input"
                        />
                        {org.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLegacyMeasureBanner && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {t("admin.inventory.legacyMeasureBanner")}
        </div>
      )}

      <InventoryBulkFileImport
        warehouses={warehouses}
        txTypes={txTypes}
        organizationId={vlOrgId || null}
        defaultMovementType="adjustment_in"
        disabled={!vlOrgId || warehouses.length === 0}
        onApplied={() => {
          if (!vlOrgId) return;
          fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=${LEVELS_FETCH_LIMIT}`)
            .then((r) => (r.ok ? r.json() : { levels: [] }))
            .then((d) => setLevels(d.levels ?? []));
        }}
      />

      <div className="surface-card-overflow">
        <h3 className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          {t("admin.inventory.myVlStockTitle")}
        </h3>
        <InventoryStockToolbar
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
              `vl-inventory-${visionLatamOrg.name ?? "stock"}`
            );
          }}
          onAddItem={() => {
            setAffectResult(null);
            setTxDialogError(null);
            setAddItemDialogOpen(true);
          }}
        />
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground max-w-prose">{t("admin.inventory.pruneZeroHelp")}</p>
          <button
            type="button"
            disabled={pruneBusy || !vlOrgId}
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
        {loadingLevels ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
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
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.lengthMmColumn")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.quantityColumn")}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t("admin.inventory.unitColumn")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase w-[1%] whitespace-nowrap">
                    {t("admin.inventory.actionsColumn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {stockGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {levels.length === 0 ? t("admin.inventory.noLevelsAddItem") : t("admin.inventory.filteredEmpty")}
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
                        <td className="px-4 py-2 text-sm text-muted-foreground">—</td>
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
                            title={mm === 0 ? t("admin.inventory.measureZeroTooltip") : undefined}
                          >
                            {mm}
                          </td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums text-foreground">{l.quantity}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{l.unit ?? "—"}</td>
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

      {selectedPartnerIds.length > 0 && (
        <div className="surface-card-overflow mt-4">
          <h3 className="text-sm font-semibold text-foreground px-4 py-2 bg-muted/50 border-b border-border">
            {t("admin.inventory.partnerLevelsReadOnlyTitle")}
          </h3>
          {loadingPartnerLevels ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t("admin.inventory.loadingShort")}</div>
          ) : (
            <div className="divide-y divide-border">
              {partnerLevels.map(({ organizationId: partnerOrgId, levels: pl }) => (
                <div key={partnerOrgId} className="p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{partnerOrgs.find((o) => o.id === partnerOrgId)?.name ?? partnerOrgId}</p>
                  {pl.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("admin.inventory.noLevelsShort")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1 pr-4 text-muted-foreground">{t("admin.inventory.warehouse")}</th>
                            <th className="text-left py-1 pr-4 text-muted-foreground">{t("admin.inventory.piece")}</th>
                            <th className="text-left py-1 pr-4 text-muted-foreground">{t("admin.inventory.system")}</th>
                            <th className="text-right py-1 pr-4 text-muted-foreground">{t("admin.inventory.lengthMmColumn")}</th>
                            <th className="text-right py-1 text-muted-foreground">{t("admin.inventory.quantityColumn")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pl.map((l) => {
                            const mm = Math.round(Number(l.lengthMm ?? 0));
                            return (
                              <tr key={l.id} className="border-b border-border/50">
                                <td className="py-1 pr-4">{l.warehouse.name}</td>
                                <td className="py-1 pr-4">{l.catalogPiece.canonicalName}</td>
                                <td className="py-1 pr-4">{l.catalogPiece.systemCode}</td>
                                <td
                                  className="py-1 pr-4 text-right tabular-nums text-muted-foreground"
                                  title={mm === 0 ? t("admin.inventory.measureZeroTooltip") : undefined}
                                >
                                  {mm}
                                </td>
                                <td className="py-1 text-right tabular-nums">{l.quantity}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="surface-card p-4 space-y-6">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">{t("admin.inventory.affectByQuoteTitle")}</h4>
          <p className="text-xs text-muted-foreground mb-2">{t("admin.inventory.affectByQuoteDescription")}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder={t("admin.inventory.quoteIdPlaceholder")}
              value={affectQuoteId}
              onChange={(e) => setAffectQuoteId(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-56"
            />
            <button
              type="button"
              onClick={handleAffect}
              disabled={txSaving || !affectQuoteId.trim()}
              className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <ArrowDownToLine className="h-4 w-4" /> {t("admin.inventory.affectButton")}
            </button>
            {affectResult && <span className="text-sm text-muted-foreground">{affectResult}</span>}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">{t("admin.inventory.simulateByQuoteTitle")}</h4>
          <p className="text-xs text-muted-foreground mb-2">{t("admin.inventory.simulateByQuoteDescription")}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder={t("admin.inventory.quoteIdPlaceholder")}
              value={simulateQuoteId}
              onChange={(e) => setSimulateQuoteId(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-56"
            />
            <button
              type="button"
              onClick={handleSimulate}
              disabled={!simulateQuoteId.trim()}
              className="rounded-lg px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1"
            >
              <Calculator className="h-4 w-4" /> {t("admin.inventory.simulateButton")}
            </button>
          </div>
          {simulateResult && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm space-y-2">
              <p className="font-medium">{t("admin.inventory.simulateRequiredByPiece")}</p>
              <ul className="list-disc list-inside">
                {simulateResult.required.map((r, i) => (
                  <li key={i}>
                    {t("admin.inventory.simulatePieceLine", {
                      name: r.pieceName,
                      code: r.systemCode,
                      quantity: r.quantity,
                    })}
                  </li>
                ))}
              </ul>
              {simulateResult.byWarehouse.length > 0 && (
                <>
                  <p className="font-medium mt-2">{t("admin.inventory.simulateByWarehouse")}</p>
                  {simulateResult.byWarehouse.map((wh, wi) => (
                    <div key={wi} className="ml-2">
                      <p className="font-medium">
                        {t("admin.inventory.simulateWarehouseOrg", {
                          warehouse: wh.warehouseName,
                          organization: wh.organizationName,
                        })}
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {wh.levels.map((lev, li) => (
                          <li key={li}>
                            {t("admin.inventory.simulateLevelLine", {
                              piece: lev.pieceName,
                              onHand: lev.onHand,
                              required: lev.required,
                              surplus: lev.surplus,
                              shortage: lev.shortage,
                            })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={addItemDialogOpen}
        onOpenChange={(open) => {
          setAddItemDialogOpen(open);
          if (!open) {
            setTxDialogError(null);
            setTxForm((f) => ({ ...f, quantityDelta: 0, notes: "", lengthMmStr: "" }));
          }
        }}
      >
        <DialogContent className="w-[min(100vw-2rem,52rem)] max-w-none sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {t("admin.inventory.addItem")} — {t("admin.inventory.catalogPiecesOnly")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.inventory.addItemDialogDescription")} {t("admin.inventory.txFormHelpSuperadmin")}{" "}
              {t("admin.inventory.lengthMmFormHelp")}
            </DialogDescription>
          </DialogHeader>
          {txDialogError && (
            <div className="rounded-lg border border-alert-warningBorder bg-alert-warning px-3 py-2 text-sm text-foreground">
              {txDialogError}
            </div>
          )}
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
                options={txTypes.map((opt) => ({ value: opt.value, label: opt.label }))}
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
                aria-required={SUPERADMIN_STOCK_IN_TYPES.has(txForm.type)}
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
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {txSaving ? t("common.saving") : t("admin.inventory.apply")}
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
                  <span className="text-muted-foreground">{t("admin.inventory.lengthMmColumn")}: </span>
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
                      name="adjust-dir"
                      checked={adjustDirection === "in"}
                      onChange={() => setAdjustDirection("in")}
                      className="rounded-full border-input"
                    />
                    {t("admin.inventory.adjustIn")}
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="adjust-dir"
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

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Package, Plus, Calculator, ArrowDownToLine, Search } from "lucide-react";
import { useT } from "@/lib/i18n/context";

type Org = { id: string; name: string };
type WarehouseRow = { id: string; name: string; location: string | null; isActive: boolean };
type LevelRow = {
  id: string;
  quantity: number;
  unit: string | null;
  warehouse: { id: string; name: string };
  catalogPiece: { id: string; canonicalName: string; systemCode: string };
};
type CatalogPieceRow = { id: string; canonicalName: string; systemCode: string };

const TRANSACTION_TYPES = [
  { value: "purchase_in", label: "Entrada (compra)" },
  { value: "adjustment_in", label: "Ajuste entrada" },
  { value: "sale_out", label: "Salida (venta)" },
  { value: "adjustment_out", label: "Ajuste salida" },
  { value: "project_consumption", label: "Consumo proyecto" },
  { value: "project_surplus", label: "Sobrante proyecto" },
] as const;

export function SuperadminInventoryClient() {
  const t = useT();
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
  const [txForm, setTxForm] = useState({ warehouseId: "", catalogPieceId: "", quantityDelta: 0, type: "adjustment_in" as string, notes: "" });
  const [txSaving, setTxSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [showAddItemForm, setShowAddItemForm] = useState(false);

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
    fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=500`)
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
        fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(organizationId)}&limit=500`)
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
        if (data.error) setAffectResult("Error: " + data.error);
        else setAffectResult(`Creadas ${data.created} transacciones.`);
        if (data.created > 0) fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=500`).then((res) => res.json()).then((d) => setLevels(d.levels ?? []));
      })
      .catch(() => setAffectResult("Error al afectar inventario."))
      .finally(() => setTxSaving(false));
  };

  const handleCreateTransaction = () => {
    if (!txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0) return;
    const delta = txForm.type.includes("out") || txForm.type === "sale_out" || txForm.type === "project_consumption" ? -Math.abs(txForm.quantityDelta) : Math.abs(txForm.quantityDelta);
    setTxSaving(true);
    fetch("/api/saas/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: txForm.warehouseId,
        catalogPieceId: txForm.catalogPieceId,
        quantityDelta: delta,
        type: txForm.type,
        organizationId: vlOrgId,
        notes: txForm.notes || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error ?? "Error"); });
        return r.json();
      })
      .then(() => {
        setTxForm({ ...txForm, quantityDelta: 0, notes: "" });
        fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(vlOrgId)}&limit=500`).then((res) => res.json()).then((d) => setLevels(d.levels ?? []));
      })
      .catch((e) => setAffectResult("Error: " + (e.message || "transacción")))
      .finally(() => setTxSaving(false));
  };

  const togglePartnerFilter = (id: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredLevels = useMemo(() => {
    if (!searchFilter.trim()) return levels;
    const q = searchFilter.trim().toLowerCase();
    return levels.filter(
      (l) =>
        l.warehouse.name.toLowerCase().includes(q) ||
        (l.catalogPiece.canonicalName ?? "").toLowerCase().includes(q) ||
        (l.catalogPiece.systemCode ?? "").toLowerCase().includes(q)
    );
  }, [levels, searchFilter]);

  const filteredPartnersForDropdown = useMemo(() => {
    if (!partnerSearchQuery.trim()) return partnerOrgs;
    const q = partnerSearchQuery.trim().toLowerCase();
    return partnerOrgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [partnerOrgs, partnerSearchQuery]);

  if (loadingOrgs) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!visionLatamOrg) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No se encontró la organización Vision Latam. Solo superadmin puede gestionar inventario.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {partnerOrgs.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground mb-2">Ver también inventario de (solo lectura):</p>
          <div className="relative max-w-md">
            <button
              type="button"
              onClick={() => setPartnerDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm text-left"
            >
              <span className="text-muted-foreground">
                {selectedPartnerIds.length === 0
                  ? "Buscar y seleccionar partners…"
                  : `${selectedPartnerIds.length} partner(s) seleccionado(s)`}
              </span>
              <span className="text-muted-foreground">{partnerDropdownOpen ? "▲" : "▼"}</span>
            </button>
            {partnerDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-border relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar partner…"
                    value={partnerSearchQuery}
                    onChange={(e) => setPartnerSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded border border-input bg-background text-sm"
                  />
                </div>
                <div className="overflow-y-auto p-2">
                  {filteredPartnersForDropdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Ningún resultado</p>
                  ) : (
                    filteredPartnersForDropdown.map((org) => (
                      <label
                        key={org.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPartnerIds.includes(org.id)}
                          onChange={() => togglePartnerFilter(org.id)}
                          className="rounded border-input"
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("admin.inventory.filterPlaceholder")}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddItemForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t("admin.inventory.addItem")}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <h3 className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Mi inventario (Vision Latam) — Stock por bodega
        </h3>
        {loadingLevels ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Bodega</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Pieza</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Sistema</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Cantidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredLevels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {levels.length === 0
                        ? "No hay niveles de inventario. Usá \"Agregar ítem\" para cargar stock (solo piezas del catálogo)."
                        : "Ningún resultado con el filtro."}
                    </td>
                  </tr>
                ) : (
                  filteredLevels.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 text-sm text-foreground">{l.warehouse.name}</td>
                      <td className="px-4 py-2 text-sm text-foreground">{l.catalogPiece.canonicalName}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{l.catalogPiece.systemCode}</td>
                      <td className="px-4 py-2 text-sm text-right text-foreground">{l.quantity}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{l.unit ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPartnerIds.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden mt-4">
          <h3 className="text-sm font-semibold text-foreground px-4 py-2 bg-muted/50 border-b border-border">
            Inventario de partners seleccionados (solo lectura)
          </h3>
          {loadingPartnerLevels ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <div className="divide-y divide-border">
              {partnerLevels.map(({ organizationId: partnerOrgId, levels: pl }) => (
                <div key={partnerOrgId} className="p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{partnerOrgs.find((o) => o.id === partnerOrgId)?.name ?? partnerOrgId}</p>
                  {pl.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin niveles.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1 pr-4 text-muted-foreground">Bodega</th>
                            <th className="text-left py-1 pr-4 text-muted-foreground">Pieza</th>
                            <th className="text-left py-1 pr-4 text-muted-foreground">Sistema</th>
                            <th className="text-right py-1 text-muted-foreground">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pl.map((l) => (
                            <tr key={l.id} className="border-b border-border/50">
                              <td className="py-1 pr-4">{l.warehouse.name}</td>
                              <td className="py-1 pr-4">{l.catalogPiece.canonicalName}</td>
                              <td className="py-1 pr-4">{l.catalogPiece.systemCode}</td>
                              <td className="py-1 text-right">{l.quantity}</td>
                            </tr>
                          ))}
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

      {showAddItemForm && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("admin.inventory.addItem")} — solo piezas del catálogo
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddItemForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("admin.inventory.close")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Elegí bodega y pieza del catálogo; el ítem se agrega o ajusta según tipo y cantidad.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Bodega</label>
                  <select
                    value={txForm.warehouseId}
                    onChange={(e) => setTxForm((f) => ({ ...f, warehouseId: e.target.value }))}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[160px]"
                  >
                    <option value="">—</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Pieza</label>
                  <select
                    value={txForm.catalogPieceId}
                    onChange={(e) => setTxForm((f) => ({ ...f, catalogPieceId: e.target.value }))}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[180px]"
                  >
                    <option value="">—</option>
                    {catalogPieces.map((p) => (
                      <option key={p.id} value={p.id}>{p.canonicalName} ({p.systemCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
                  <select
                    value={txForm.type}
                    onChange={(e) => setTxForm((f) => ({ ...f, type: e.target.value }))}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[160px]"
                  >
                    {TRANSACTION_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={txForm.quantityDelta || ""}
                    onChange={(e) => setTxForm((f) => ({ ...f, quantityDelta: Number(e.target.value) || 0 }))}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-24"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Notas</label>
                  <input
                    type="text"
                    value={txForm.notes}
                    onChange={(e) => setTxForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Opcional"
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-40"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateTransaction}
                  disabled={txSaving || !txForm.warehouseId || !txForm.catalogPieceId || txForm.quantityDelta === 0}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Aplicar
                </button>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium text-foreground mb-2">Afectar inventario por cotización</h4>
                <p className="text-xs text-muted-foreground mb-2">Solo aplica si la cotización tiene ítems ligados a piezas del catálogo (ej. importación CSV). Cotizar solo por m² es estimación y no genera requeridos por pieza.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="ID de cotización"
                    value={affectQuoteId}
                    onChange={(e) => setAffectQuoteId(e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-56"
                  />
                  <button
                    type="button"
                    onClick={handleAffect}
                    disabled={txSaving || !affectQuoteId.trim()}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <ArrowDownToLine className="h-4 w-4" /> Afectar
                  </button>
                  {affectResult && <span className="text-sm text-muted-foreground">{affectResult}</span>}
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium text-foreground mb-2">Simular sobrante/faltante por cotización</h4>
                <p className="text-xs text-muted-foreground mb-2">Usa ítems de la cotización con pieza de catálogo asignada. Si la cotización es solo por m² (estimación), no habrá requeridos por pieza.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="ID de cotización"
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
                    <Calculator className="h-4 w-4" /> Simular
                  </button>
                </div>
                {simulateResult && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm space-y-2">
                    <p className="font-medium">Requerido por pieza:</p>
                    <ul className="list-disc list-inside">
                      {simulateResult.required.map((r, i) => (
                        <li key={i}>{r.pieceName} ({r.systemCode}): {r.quantity}</li>
                      ))}
                    </ul>
                    {simulateResult.byWarehouse.length > 0 && (
                      <>
                        <p className="font-medium mt-2">Por bodega:</p>
                        {simulateResult.byWarehouse.map((wh, wi) => (
                          <div key={wi} className="ml-2">
                            <p className="font-medium">{wh.warehouseName} — {wh.organizationName}</p>
                            <ul className="list-disc list-inside text-muted-foreground">
                              {wh.levels.map((lev, li) => (
                                <li key={li}>{lev.pieceName}: en mano {lev.onHand}, requerido {lev.required}, sobrante {lev.surplus}, faltante {lev.shortage}</li>
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
      )}
    </div>
  );
}

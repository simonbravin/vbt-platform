"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Calculator, ArrowDownToLine } from "lucide-react";
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
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [visionLatamOrg, setVisionLatamOrg] = useState<Org | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
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

  const isVisionLatam = selectedOrgId && visionLatamOrg && selectedOrgId === visionLatamOrg.id;

  const loadOrgs = useCallback(() => {
    setLoadingOrgs(true);
    Promise.all([
      fetch("/api/saas/partners?limit=200").then((r) => r.json()),
      fetch("/api/saas/inventory/vision-latam-org").then((r) => r.json()),
    ])
      .then(([partnersData, vlData]) => {
        const partners = (partnersData.partners ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name ?? "—" })).filter((o: Org) => o.id);
        const vl = vlData.organization ? { id: vlData.organization.id, name: vlData.organization.name + " (Vision Latam)" } : null;
        if (vl) setVisionLatamOrg(vl);
        setOrganizations(vl ? [vl, ...partners] : partners);
        if (!selectedOrgId && vl) setSelectedOrgId(vl.id);
        else if (!selectedOrgId && partners[0]) setSelectedOrgId(partners[0].id);
      })
      .catch(() => setOrganizations([]))
      .finally(() => setLoadingOrgs(false));
  }, [selectedOrgId]);

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (!selectedOrgId) {
      setWarehouses([]);
      setLevels([]);
      return;
    }
    setLoadingWarehouses(true);
    setLoadingLevels(true);
    fetch(`/api/saas/warehouses?organizationId=${encodeURIComponent(selectedOrgId)}`)
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []))
      .catch(() => setWarehouses([]))
      .finally(() => setLoadingWarehouses(false));
    fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(selectedOrgId)}&limit=500`)
      .then((r) => r.json())
      .then((data) => setLevels(data.levels ?? []))
      .catch(() => setLevels([]))
      .finally(() => setLoadingLevels(false));
  }, [selectedOrgId]);

  useEffect(() => {
    if (isVisionLatam) {
      fetch("/api/catalog")
        .then((r) => r.json())
        .then((data) => setCatalogPieces(Array.isArray(data) ? data : []))
        .catch(() => setCatalogPieces([]));
    }
  }, [isVisionLatam]);

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
        if (data.created > 0) fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(selectedOrgId)}&limit=500`).then((res) => res.json()).then((d) => setLevels(d.levels ?? []));
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
        organizationId: selectedOrgId,
        notes: txForm.notes || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error ?? "Error"); });
        return r.json();
      })
      .then(() => {
        setTxForm({ ...txForm, quantityDelta: 0, notes: "" });
        fetch(`/api/saas/inventory/levels?organizationId=${encodeURIComponent(selectedOrgId)}&limit=500`).then((res) => res.json()).then((d) => setLevels(d.levels ?? []));
      })
      .catch((e) => setAffectResult("Error: " + (e.message || "transacción")))
      .finally(() => setTxSaving(false));
  };

  if (loadingOrgs) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-foreground">Organización:</label>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm min-w-[220px]"
        >
          <option value="">— Seleccionar —</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {selectedOrgId && (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loadingLevels ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : levels.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay niveles de inventario para esta organización.</p>
              </div>
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
                    {levels.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2 text-sm text-foreground">{l.warehouse.name}</td>
                        <td className="px-4 py-2 text-sm text-foreground">{l.catalogPiece.canonicalName}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{l.catalogPiece.systemCode}</td>
                        <td className="px-4 py-2 text-sm text-right text-foreground">{l.quantity}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{l.unit ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isVisionLatam && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Transacciones (Vision Latam)</h3>
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

          {selectedOrgId && !isVisionLatam && (
            <p className="text-sm text-muted-foreground">Vista solo lectura para partners. Solo Vision Latam puede crear transacciones desde aquí.</p>
          )}
        </>
      )}

      {!selectedOrgId && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Seleccioná una organización para ver inventario y bodegas.</p>
        </div>
      )}
    </div>
  );
}

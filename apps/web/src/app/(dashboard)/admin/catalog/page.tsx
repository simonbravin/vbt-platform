"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Upload, Edit } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const CATALOG_SYSTEMS = ["S80", "S150", "S200"] as const;
type CatalogSystemCode = (typeof CATALOG_SYSTEMS)[number];

const defaultSystemFilters = (): Record<CatalogSystemCode, boolean> => ({
  S80: true,
  S150: true,
  S200: true,
});

export default function CatalogPage() {
  const t = useT();
  const [pieces, setPieces] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [systemOn, setSystemOn] = useState<Record<CatalogSystemCode, boolean>>(defaultSystemFilters);
  const [loading, setLoading] = useState(true);
  const [importDialog, setImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [editPiece, setEditPiece] = useState<any>(null);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const enabled = CATALOG_SYSTEMS.filter((c) => systemOn[c]);
    if (enabled.length === 0) {
      setPieces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (enabled.length < CATALOG_SYSTEMS.length) {
      params.set("systems", enabled.join(","));
    }
    if (incompleteOnly) params.set("incomplete", "1");
    fetch(`/api/catalog?${params}`)
      .then(async (r) => {
        let list: unknown[] = [];
        try {
          const d = await r.json();
          if (Array.isArray(d)) list = d;
        } catch {
          /* invalid JSON */
        }
        setPieces(list);
        setLoading(false);
      })
      .catch(() => {
        setPieces([]);
        setLoading(false);
      });
  }, [search, systemOn, incompleteOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = async (dryRun: boolean) => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/catalog/import?dryRun=${dryRun}`, { method: "POST", body: fd });
    const data = await res.json();
    setImportResult({ ...data, dryRun });
    setImporting(false);
    if (!dryRun) load();
  };

  const saveEdit = async () => {
    if (!editPiece) return;
    await fetch(`/api/catalog/${editPiece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pricePerM2Cored: editPiece._costEdit ?? editPiece.costs?.[0]?.pricePerM2Cored,
        usefulWidthMm: editPiece.usefulWidthMm,
        isActive: editPiece.isActive,
      }),
    });
    setEditPiece(null);
    load();
  };

  const SYS_COLORS: Record<string, string> = {
    S80: "bg-blue-100 text-blue-700",
    S150: "bg-green-100 text-green-700",
    S200: "bg-purple-100 text-purple-700",
  };
  const SYS_LABELS: Record<string, string> = useMemo(
    () => ({
      S80: t("admin.catalog.s80"),
      S150: t("admin.catalog.s150"),
      S200: t("admin.catalog.s200"),
    }),
    [t]
  );
  const tableColumns = useMemo(
    () =>
      [
        { key: "die", label: t("admin.catalog.dieNumber"), align: "left" as const },
        { key: "name", label: t("admin.catalog.canonicalName"), align: "left" as const },
        { key: "system", label: t("admin.catalog.system"), align: "center" as const },
        { key: "width", label: t("admin.catalog.usefulWidthMm"), align: "center" as const },
        { key: "lbs", label: t("admin.catalog.lbsPerMCored"), align: "center" as const },
        { key: "kg", label: t("admin.catalog.kgPerMCored"), align: "center" as const },
        { key: "price", label: t("admin.catalog.pricePerMCored"), align: "center" as const },
        { key: "active", label: t("admin.catalog.active"), align: "center" as const },
        { key: "actions", label: t("admin.catalog.actions"), align: "center" as const },
      ],
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.catalog.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{pieces.length} {t("admin.catalog.pieces")}</p>
        </div>
        <button
          type="button"
          onClick={() => setImportDialog(true)}
          className="inline-flex items-center gap-2 rounded-sm border border-orange-600/30 bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Upload className="w-4 h-4" /> {t("admin.catalog.import")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("admin.catalog.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-sm border border-input bg-background py-2 pl-9 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => setIncompleteOnly(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span>{t("admin.catalog.incompleteOnly")}</span>
        </label>
        <p className="w-full text-xs text-muted-foreground sm:w-auto">{t("admin.catalog.incompleteOnlyHint")}</p>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("admin.catalog.system")}
        >
          {CATALOG_SYSTEMS.map((code) => {
            const on = systemOn[code];
            const onClass =
              code === "S80"
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : code === "S150"
                  ? "bg-green-100 text-green-800 border-green-300"
                  : "bg-purple-100 text-purple-800 border-purple-300";
            const offClass = "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted";
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                onClick={() => setSystemOn((prev) => ({ ...prev, [code]: !prev[code] }))}
                className={`rounded-sm border px-3 py-2 text-sm font-medium transition-colors ${on ? onClass : offClass}`}
              >
                {SYS_LABELS[code] ?? code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-sm border border-border/60 bg-card ring-1 ring-border/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                {tableColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase text-muted-foreground ${col.align === "center" ? "text-center" : "text-left"}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              ) : CATALOG_SYSTEMS.every((c) => !systemOn[c]) ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("admin.catalog.enableOneSystem")}
                  </td>
                </tr>
              ) : pieces.map((p) => (
                <tr key={p.id} className={`hover:bg-muted/20 ${!p.isActive ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2.5 text-left text-xs text-muted-foreground">{p.dieNumber ?? "—"}</td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-left font-medium text-foreground">{p.canonicalName}</td>
                  <td className="px-3 py-2.5 text-center">
                    {p.systemCode ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SYS_COLORS[p.systemCode] ?? "bg-muted text-foreground"}`}>
                        {SYS_LABELS[p.systemCode] ?? p.systemCode}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{p.usefulWidthMm?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{p.lbsPerMCored?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{p.kgPerMCored?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center font-medium tabular-nums">
                    {p.costs?.[0]?.pricePerM2Cored
                      ? `$${p.costs[0].pricePerM2Cored.toFixed(2)}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${p.isActive ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
                      {p.isActive ? t("admin.catalog.active") : t("admin.catalog.inactive")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => setEditPiece({ ...p, _costEdit: p.costs?.[0]?.pricePerM2Cored ?? 0 })}
                      className="inline-flex rounded-sm p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Dialog */}
      {importDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="m-4 w-full max-w-lg rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60">
            <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{t("admin.catalog.importTitle")}</h3>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-sm file:border file:border-border/60 file:bg-muted/30 file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
            />
            {importResult && (
              <div className="mt-4 space-y-1 rounded-sm border border-border/60 bg-muted/20 p-4 text-sm">
                <p className="font-medium">{importResult.dryRun ? t("admin.catalog.dryRunPreview") : t("admin.catalog.importComplete")}</p>
                <p className="text-green-700">{t("admin.catalog.created")}: {importResult.created}</p>
                <p className="text-blue-700">{t("admin.catalog.updated")}: {importResult.updated}</p>
                <p className="text-muted-foreground">{t("admin.catalog.unchanged")}: {importResult.unchanged}</p>
                <p className="text-muted-foreground">{t("admin.catalog.total")}: {importResult.total}</p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => { setImportDialog(false); setImportResult(null); }} className="rounded-sm border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-muted">{t("common.cancel")}</button>
              <button type="button" onClick={() => handleImport(true)} disabled={importing} className="rounded-sm border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50">
                {importing ? "..." : t("admin.catalog.dryRun")}
              </button>
              <button type="button" onClick={() => handleImport(false)} disabled={importing} className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {importing ? t("admin.catalog.importing") : t("admin.catalog.importNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Piece Dialog */}
      {editPiece && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="m-4 w-full max-w-md rounded-sm border border-border/60 bg-background p-6 ring-1 ring-border/60">
            <h3 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{t("admin.catalog.editPiece")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{editPiece.canonicalName}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.catalog.pricePerM")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPiece._costEdit}
                  onChange={(e) => setEditPiece((p: any) => ({ ...p, _costEdit: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("admin.catalog.usefulWidth")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editPiece.usefulWidthMm ?? 0}
                  onChange={(e) => setEditPiece((p: any) => ({ ...p, usefulWidthMm: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setEditPiece(null)} className="rounded-sm border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-muted">{t("common.cancel")}</button>
              <button type="button" onClick={saveEdit} className="rounded-sm border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

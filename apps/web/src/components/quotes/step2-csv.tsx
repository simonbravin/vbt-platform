"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/context"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { QuoteWizardState, UnmatchedRow } from "./step1-method"

interface Step2Props {
  state: QuoteWizardState
  update: (patch: Partial<QuoteWizardState>) => void
}

interface ImportResult {
  revitImportId: string
  totalRows: number
  matchedCount: number
  unmatchedRows: UnmatchedRow[]
}

interface CatalogItem {
  id: string
  sku: string
  description: string
  systemType: string
}

interface ImportLine {
  rawPieceName: string
  rawQty: number
  rawHeightMm: number
  linearM: number | null
  m2Line: number | null
  pieceId: string | null
  piece?: { canonicalName?: string; systemCode?: string } | null
}

export default function Step2CSV({ state, update }: Step2Props) {
  const t = useT()
  const [file, setFile] = React.useState<File | null>(state.csvFile)
  const [uploading, setUploading] = React.useState(false)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const [importLines, setImportLines] = React.useState<ImportLine[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [mappingRow, setMappingRow] = React.useState<UnmatchedRow | null>(null)
  const [catalogSearch, setCatalogSearch] = React.useState("")
  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    update({ csvFile: f })
    setResult(null)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file) return
    if (!state.projectId) {
      setError(t("wizard.selectProjectStep1"))
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("projectId", state.projectId)
      const res = await fetch("/api/import/csv", { method: "POST", body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? (t("wizard.uploadFailed") + " (" + res.status + ")"))
      }
      const data: ImportResult = await res.json()
      setResult(data)
      update({ revitImportId: data.revitImportId, unmatchedRows: data.unmatchedRows })
      // Load full import with lines for interpreted table
      fetch("/api/import/" + data.revitImportId)
        .then((r) => r.json())
        .then((imp: { lines?: ImportLine[] }) => setImportLines(imp?.lines ?? []))
        .catch(() => setImportLines([]))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  const handleIgnore = (rowIndex: number) => {
    const updated = (result?.unmatchedRows ?? []).map((r) =>
      r.rowIndex === rowIndex ? { ...r, ignored: true } : r
    )
    setResult((prev) => prev ? { ...prev, unmatchedRows: updated } : prev)
    update({ unmatchedRows: updated })
  }

  const openMapDialog = (row: UnmatchedRow) => {
    setMappingRow(row)
    setCatalogSearch("")
    setCatalogItems([])
  }

  React.useEffect(() => {
    if (!mappingRow) return
    if (catalogSearch.trim().length < 2) { setCatalogItems([]); return }
    const controller = new AbortController()
    setSearchLoading(true)
    fetch("/api/catalog?q=" + encodeURIComponent(catalogSearch), { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setCatalogItems(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {})
      .finally(() => setSearchLoading(false))
    return () => controller.abort()
  }, [catalogSearch, mappingRow])

  const handleMapSelect = async (catalogItem: CatalogItem) => {
    if (!mappingRow || !state.revitImportId) return
    try {
      await fetch("/api/import/" + state.revitImportId + "/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: mappingRow.rowIndex, catalogId: catalogItem.id }),
      })
      const updated = (result?.unmatchedRows ?? []).map((r) =>
        r.rowIndex === mappingRow.rowIndex ? { ...r, mappedCatalogId: catalogItem.id } : r
      )
      setResult((prev) => prev ? { ...prev, unmatchedRows: updated } : prev)
      update({ unmatchedRows: updated })
      setMappingRow(null)
    } catch {
      // silently fail, user can retry
    }
  }

  const unmatchedActive = (result?.unmatchedRows ?? []).filter((r) => !r.ignored && !r.mappedCatalogId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">{t("wizard.step2Title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("wizard.step2Desc")}
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="csv-file">{t("wizard.revitCsvLabel")}</Label>
        <div className="flex items-center gap-3">
          <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="max-w-sm" />
          <Button type="button" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? t("wizard.uploading") : t("wizard.uploadParse")}
          </Button>
        </div>
        {file && !result && (
          <p className="text-xs text-muted-foreground">{t("wizard.selectedFile")}: {file.name}</p>
        )}
      </div>
      {uploading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      )}
      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="default">{t("wizard.totalRows")}: {result.totalRows}</Badge>
            <Badge variant="secondary">{t("wizard.matched")}: {result.matchedCount}</Badge>
            <Badge variant={unmatchedActive.length > 0 ? "destructive" : "outline"}>
              {t("wizard.unmatched")}: {unmatchedActive.length}
            </Badge>
          </div>
          {importLines.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">{t("wizard.interpretedData")}</h3>
              <div className="rounded-md border overflow-x-auto max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("wizard.typePiece")}</TableHead>
                      <TableHead className="text-right">{t("quotes.qty")}</TableHead>
                      <TableHead className="text-right">{t("wizard.heightMm")}</TableHead>
                      <TableHead className="text-right">{t("wizard.linearM")}</TableHead>
                      <TableHead className="text-right">m²</TableHead>
                      <TableHead>{t("wizard.matchColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importLines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate" title={line.rawPieceName}>{line.rawPieceName}</TableCell>
                        <TableCell className="text-right">{line.rawQty}</TableCell>
                        <TableCell className="text-right">{line.rawHeightMm}</TableCell>
                        <TableCell className="text-right">{line.linearM != null ? line.linearM.toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-right">{line.m2Line != null ? line.m2Line.toFixed(2) : "—"}</TableCell>
                        <TableCell>{line.pieceId ? (line.piece?.systemCode ?? "OK") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {result.unmatchedRows.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">{t("wizard.unmatchedRows")}</h3>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("wizard.revitFamily")}</TableHead>
                      <TableHead>{t("wizard.type")}</TableHead>
                      <TableHead className="text-right">{t("quotes.qty")}</TableHead>
                      <TableHead className="text-right">{t("wizard.areaM2")}</TableHead>
                      <TableHead>{t("wizard.status")}</TableHead>
                      <TableHead className="text-right">{t("wizard.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.unmatchedRows.map((row) => (
                      <TableRow key={row.rowIndex}>
                        <TableCell className="font-mono text-xs">{row.revitFamily}</TableCell>
                        <TableCell className="font-mono text-xs">{row.revitType}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{row.area.toFixed(2)}</TableCell>
                        <TableCell>
                          {row.ignored ? (
                            <Badge variant="outline">{t("wizard.ignored")}</Badge>
                          ) : row.mappedCatalogId ? (
                            <Badge variant="secondary">{t("wizard.mapped")}</Badge>
                          ) : (
                            <Badge variant="destructive">{t("wizard.unmatched")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!row.ignored && !row.mappedCatalogId && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openMapDialog(row)}>{t("wizard.map")}</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleIgnore(row.rowIndex)}>{t("wizard.ignore")}</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {unmatchedActive.length === 0 && (
            <Alert>
              <AlertDescription>{t("wizard.allRowsMatched")}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <Dialog open={!!mappingRow} onOpenChange={(open) => !open && setMappingRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("wizard.mapToCatalog")}</DialogTitle>
          </DialogHeader>
          {mappingRow && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p><span className="font-medium">{t("wizard.family")}:</span> {mappingRow.revitFamily}</p>
                <p><span className="font-medium">{t("wizard.typeLabel")}:</span> {mappingRow.revitType}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-search">{t("wizard.searchCatalog")}</Label>
                <Input
                  id="catalog-search"
                  placeholder={t("wizard.typeSkuDesc")}
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
              </div>
              {searchLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              )}
              {catalogItems.length > 0 && (
                <div className="rounded-md border overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>{t("quotes.description")}</TableHead>
                        <TableHead>{t("quotes.system")}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalogItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell><Badge variant="outline">{item.systemType}</Badge></TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => handleMapSelect(item)}>{t("wizard.select")}</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!searchLoading && catalogSearch.trim().length >= 2 && catalogItems.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("wizard.noCatalogItems")}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingRow(null)}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

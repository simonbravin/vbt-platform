"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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

export default function Step2CSV({ state, update }: Step2Props) {
  const [file, setFile] = React.useState<File | null>(state.csvFile)
  const [uploading, setUploading] = React.useState(false)
  const [result, setResult] = React.useState<ImportResult | null>(null)
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
      setError("Please select a project in Step 1 before uploading.")
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
        throw new Error(body.error ?? ("Upload failed (" + res.status + ")"))
      }
      const data: ImportResult = await res.json()
      setResult(data)
      update({ revitImportId: data.revitImportId, unmatchedRows: data.unmatchedRows })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
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
        <h2 className="text-xl font-semibold mb-1">Step 2: CSV / Revit Import</h2>
        <p className="text-sm text-muted-foreground">
          Upload a Revit wall schedule CSV. The system will match rows to the product catalog
          automatically. Unmatched rows can be manually mapped or ignored.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="csv-file">Revit Wall Schedule CSV</Label>
        <div className="flex items-center gap-3">
          <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="max-w-sm" />
          <Button type="button" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload & Parse"}
          </Button>
        </div>
        {file && !result && (
          <p className="text-xs text-muted-foreground">Selected: {file.name}</p>
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
            <Badge variant="default">Total rows: {result.totalRows}</Badge>
            <Badge variant="secondary">Matched: {result.matchedCount}</Badge>
            <Badge variant={unmatchedActive.length > 0 ? "destructive" : "outline"}>
              Unmatched: {unmatchedActive.length}
            </Badge>
          </div>
          {result.unmatchedRows.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Unmatched Rows</h3>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Revit Family</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Area (m&sup2;)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                            <Badge variant="outline">Ignored</Badge>
                          ) : row.mappedCatalogId ? (
                            <Badge variant="secondary">Mapped</Badge>
                          ) : (
                            <Badge variant="destructive">Unmatched</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!row.ignored && !row.mappedCatalogId && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openMapDialog(row)}>Map</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleIgnore(row.rowIndex)}>Ignore</Button>
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
              <AlertDescription>All rows are matched or resolved. You can proceed to the next step.</AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <Dialog open={!!mappingRow} onOpenChange={(open) => !open && setMappingRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Map to Catalog Item</DialogTitle>
          </DialogHeader>
          {mappingRow && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p><span className="font-medium">Family:</span> {mappingRow.revitFamily}</p>
                <p><span className="font-medium">Type:</span> {mappingRow.revitType}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-search">Search catalog</Label>
                <Input
                  id="catalog-search"
                  placeholder="Type SKU or description..."
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
                        <TableHead>Description</TableHead>
                        <TableHead>System</TableHead>
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
                            <Button size="sm" onClick={() => handleMapSelect(item)}>Select</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!searchLoading && catalogSearch.trim().length >= 2 && catalogItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No catalog items found.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingRow(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

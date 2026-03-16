"use client"
import * as React from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/context"

export type CostMethod = "CSV" | "M2_BY_SYSTEM"
export type UOM = "M" | "FT"

export interface QuoteWizardState {
  projectId: string
  costMethod: CostMethod
  uom: UOM
  warehouseId: string
  reserveStock: boolean
  revitImportId: string
  // Step 2 - CSV
  csvFile: File | null
  unmatchedRows: UnmatchedRow[]
  // Step 3 - Material
  m2S80: number
  m2S150: number
  m2S200: number
  materialCost: number
  totalWeight: number
  totalVolume: number
  // Step 4 - Commission
  commissionPct: number
  commissionFixed: number
  kitsPerContainer: number
  totalKits: number
  numContainers: number
  // Step 5 - Destination
  countryId: string
  freightId: string
  freightOverride: number | null
  // Step 6
  notes: string
}

export interface UnmatchedRow {
  rowIndex: number
  revitFamily: string
  revitType: string
  quantity: number
  area: number
  mappedCatalogId: string | null
  ignored: boolean
}

interface Step1Props {
  state: QuoteWizardState
  update: (patch: Partial<QuoteWizardState>) => void
}

interface Project {
  id: string
  name: string
  code: string
}

interface Warehouse {
  id: string
  name: string
  city: string
  countryCode: string
}

export default function Step1Method({ state, update }: Step1Props) {
  const t = useT()
  const [projects, setProjects] = React.useState<Project[]>([])
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([])
  const [loadingProjects, setLoadingProjects] = React.useState(true)
  const [loadingWarehouses, setLoadingWarehouses] = React.useState(true)

  const METHOD_OPTIONS: { value: CostMethod; label: string; description: string }[] = React.useMemo(
    () => [
      { value: "CSV" as CostMethod, label: t("wizard.csvRevitLabel"), description: t("wizard.csvRevitDesc") },
      { value: "M2_BY_SYSTEM" as CostMethod, label: t("wizard.m2BySystemLabel"), description: t("wizard.m2BySystemDesc") },
    ],
    [t]
  )

  React.useEffect(() => {
    setLoadingProjects(true)
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : data.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false))
  }, [])

  React.useEffect(() => {
    setLoadingWarehouses(true)
    fetch("/api/saas/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data?.warehouses) ? data.warehouses : []))
      .catch(() => setWarehouses([]))
      .finally(() => setLoadingWarehouses(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Step 1: Project &amp; Method</h2>
        <p className="text-sm text-muted-foreground">
          Select the project, costing method, unit of measure, and warehouse for this quote.
        </p>
      </div>

      {/* Project selector */}
      <div className="space-y-2">
        <Label htmlFor="project-select">Project</Label>
        <Select
          value={state.projectId}
          onValueChange={(v) => update({ projectId: v })}
          disabled={loadingProjects}
        >
          <SelectTrigger id="project-select" className="w-full">
            <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Select a project"} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Costing method cards */}
      <div className="space-y-2">
        <Label>{t("wizard.costingMethod")}</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ costMethod: opt.value })}
              className={cn(
                "text-left rounded-lg border p-4 transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
                state.costMethod === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-background"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm">{opt.label}</span>
                {state.costMethod === opt.value && (
                  <Badge variant="default" className="text-xs shrink-0">
                    {t("wizard.selected")}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* UOM selector */}
      <div className="space-y-2">
        <Label htmlFor="uom-select">{t("wizard.unitOfMeasure")}</Label>
        <Select
          value={state.uom}
          onValueChange={(v) => update({ uom: v as UOM })}
        >
          <SelectTrigger id="uom-select" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M">{t("wizard.metersM")}</SelectItem>
            <SelectItem value="FT">{t("wizard.feetFT")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Warehouse selector */}
      <div className="space-y-2">
        <Label htmlFor="warehouse-select">{t("wizard.originWarehouse")}</Label>
        <Select
          value={state.warehouseId}
          onValueChange={(v) => update({ warehouseId: v })}
          disabled={loadingWarehouses}
        >
          <SelectTrigger id="warehouse-select" className="w-full sm:w-80">
            <SelectValue placeholder={loadingWarehouses ? t("wizard.loadingWarehouses") : t("wizard.selectWarehouse")} />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name} ({w.city}, {w.countryCode})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reserve stock toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="reserve-stock"
          checked={state.reserveStock}
          onCheckedChange={(v) => update({ reserveStock: v })}
        />
        <Label htmlFor="reserve-stock" className="cursor-pointer">
          {t("wizard.reserveStock")}
        </Label>
      </div>
    </div>
  )
}

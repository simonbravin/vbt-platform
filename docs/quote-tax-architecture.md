# Impuestos en cotizaciones SaaS — arquitectura definitiva

Refleja el código tras snapshot obligatorio + backfill (marzo 2026).

## Fuente de verdad en **escritura** (sigue vigente)

1. **Proyecto** (`Project.countryCode`, ISO-2).
2. **País** (`Country` por `code`).
3. **TaxRuleSet** para ese `countryId`:
   - primero override de la **organización de la cotización**;
   - si no existe, set **base de plataforma** (`organizationId` null).

Implementación: `resolveTaxRulesForSaaSQuote` en [`packages/core/src/services/quote-tax-rules.ts`](../packages/core/src/services/quote-tax-rules.ts).

## Snapshot obligatorio en **lectura**

- Columna: `quotes.tax_rules_snapshot_json` (JSONB, `TaxRule[]` validado con Zod).
- **Toda** lectura financiera (`formatQuoteForSaaSApiWithSnapshot`, `toLegacySalesQuoteShape` sin `taxRules` explícitos) usa **solo** el snapshot vía `requireTaxRulesSnapshotFromQuote`.
- **No** hay resolución runtime desde `TaxRuleSet` en el read model. Si falta o el JSON es inválido → `QuoteMissingTaxSnapshotError` → API **422** (o payload estructurado vía `normalizeApiError` en SaaS handler).

## Contrato histórico

- Al **guardar** con recomputo (`POST` / `PATCH` / `duplicateQuote`), se persiste el snapshot de reglas **vigentes en ese momento** y los totales canónicos.
- Las cotizaciones **no** cambian solas cuando un admin edita `TaxRuleSet`; solo cambian si se vuelve a persistir pricing.

## Backfill y verificación

Script único en la raíz del repo:

```bash
pnpm run backfill:quote-tax-snapshots backfill   # escribe snapshot + alinea totales/líneas
pnpm run backfill:quote-tax-snapshots verify    # debe pasar (exit 0) en producción
```

- Carga `packages/db/.env` para `DATABASE_URL`.
- **Idempotente:** por defecto solo procesa filas con snapshot **NULL** (`Prisma.DbNull`). Con `INCLUDE_INVALID_SNAPSHOT=1` también reescribe JSON que no pasa validación Zod.
- **Clasificación:**
  - **A:** `countryCode` + `TaxRuleSet` → actualiza snapshot + `canonicalizeSaaSQuotePayload` + ítems/totales.
  - **B:** `countryCode` pero sin `TaxRuleSet` → **FAIL** (línea `FAIL` en stderr, sin escribir fila).
  - **C:** sin `countryCode` o país inexistente → **FAIL** (igual).
- **Verify:** cuenta snapshots faltantes, JSON inválidos, y desvíos `totalPrice`/`factoryCostTotal` vs recomputo canónico (tolerancia 0.02 USD).

**Requisito:** la migración `20260321120000_quote_tax_rules_snapshot` debe estar aplicada antes de ejecutar el script.

## Errores HTTP

| Situación | Código / helper |
|-----------|------------------|
| Escritura sin poder resolver reglas | `QuoteTaxResolutionError` → **400** |
| Lectura sin snapshot o JSON inválido | `QuoteMissingTaxSnapshotError` → **422** (`normalizeApiError` en `/api/saas/*`) |

## Superficies

| Superficie | Comportamiento |
|------------|----------------|
| SaaS CRUD | Resolución solo al persistir; respuestas con `formatQuoteForSaaSApiWithSnapshot`. |
| Legacy `/api/quotes/*` | Mismo read model; 422 si falta snapshot. |
| PDF | `toLegacySalesQuoteShape`; error normalizado si falta snapshot. |

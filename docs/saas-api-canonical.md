# API SaaS canónica vs legacy (`apps/web`)

**Canónica (objetivo):** rutas bajo `/api/saas/*` que usan `getTenantContext` / `requireActiveOrg` y servicios `@vbt/core`.

**Legacy:** rutas bajo `/api/*` que duplican dominio o usan solo sesión + Prisma directo. Se mantienen por compatibilidad; el código marca el contrato preferido en comentarios de cada handler.

## Cotizaciones — consumo actual

| Superficie | Endpoint | Uso |
|------------|----------|-----|
| Partner listado | `/api/saas/quotes` | [`QuotesClient.tsx`](../apps/web/src/app/(dashboard)/quotes/QuotesClient.tsx), listados superadmin |
| Partner crear borrador | `POST /api/saas/quotes` | [`quotes/create/page.tsx`](../apps/web/src/app/(dashboard)/quotes/create/page.tsx) |
| Partner detalle | `GET/PATCH/DELETE /api/saas/quotes/[id]` | [`quotes/[id]/page.tsx`](../apps/web/src/app/(dashboard)/quotes/[id]/page.tsx) |
| Partner borrar en lista | `DELETE /api/saas/quotes/[id]` | [`QuotesClient.tsx`](../apps/web/src/app/(dashboard)/quotes/QuotesClient.tsx) |
| Legacy detalle (compat) | `GET/PATCH/DELETE /api/quotes/[id]` | Sigue disponible para integraciones; la UI partner ya no lo usa para CRUD principal |
| Superadmin detalle | `/api/saas/quotes/[id]` | [`SuperadminQuoteDetailClient.tsx`](../apps/web/src/app/(superadmin)/superadmin/quotes/[id]/SuperadminQuoteDetailClient.tsx) |
| Ventas — cotizaciones por proyecto | `GET /api/quotes?projectId=` | [`NewSaleClient.tsx`](../apps/web/src/app/(dashboard)/sales/new/NewSaleClient.tsx) |

## Endpoints a migrar después (prioridad sugerida)

1. ~~`GET/PATCH/DELETE /api/quotes/[id]`~~ — detalle/borrado partner migrados a `/api/saas/quotes/[id]`. Opcional: proxy legacy → SaaS o `410` cuando no queden consumidores.
2. `GET /api/quotes` (lista enriquecida para ventas) → `GET /api/saas/quotes` con mismos query params / shape de respuesta o capa de mapeo compartida.
3. Subrecursos bajo `/api/quotes/[id]/*` (pdf, email, audit) → equivalentes SaaS o un solo prefijo `/api/saas/quotes/[id]/...` cuando existan.

## Estado de cotización

Valores persistidos: enum Prisma `QuoteStatus` (`draft`, `sent`, `accepted`, `rejected`, `expired`, `archived`). Normalización: `normalizeQuoteStatus` en `@vbt/core`. Las etiquetas legacy `ARCHIVED` / `CANCELLED` se mapean a **`archived`** (no a `rejected`). Las notas internas viven en la columna `quotes.notes`.

## Fase B (consolidación)

Plan detallado, checklist de migración front, flujo de cotización, pricing façade, documentos e ingeniería: [phase-b-architecture.md](./phase-b-architecture.md).

## Fase C (pricing y consistencia)

Rutas de cálculo, stack SaaS vs wizard, `pricing` en respuestas y modo seguro en `POST /api/saas/quotes`: [phase-c-pricing-consistency.md](./phase-c-pricing-consistency.md).

## Consolidación final (quote + pricing)

Arquitectura autoritativa actual (read model, ítems, totales servidor, legacy): [quote-pricing-final.md](./quote-pricing-final.md).

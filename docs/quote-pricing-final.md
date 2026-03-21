# Cotización y pricing — arquitectura final (post-consolidación)

Este documento describe el **código actual** tras la consolidación: una sola verdad para precios SaaS persistidos, un solo read model financiero, y límites claros respecto al wizard CSV.

## 1. Modelo canónico de pricing SaaS (persistido)

**Autoridad:** `priceSaaSQuoteLayers` (`packages/core/src/pricing/saas-layers.ts`) compone únicamente primitivas de `calculations.ts` (`computeCif`, `computeTaxLines`, `sumTaxLines`).

**Cadena de negocio (headers SaaS):**

1. EXW agregado (`factoryCostTotal` en DB = suma de líneas normalizadas **o** único monto de cabecera si no hay líneas).
2. × (1 + Vision Latam %).
3. × (1 + partner %).
4. Flete marítimo/local (`logisticsCost` + `localTransportCost`) vía `computeCif` sobre el subtotal post-partner.
5. + `importCost`.
6. Impuestos por reglas (`computeTaxLines` / `sumTaxLines`).
7. + `technicalServiceCost`.

**Total persistido (`totalPrice`):** siempre `suggestedLandedUsd` de esa cadena — aplicado en **`canonicalizeSaaSQuotePayload`** (`packages/core/src/pricing/saas-quote-persist.ts`).

**Ya no es autoritativo para SaaS:**

- Cualquier `totalPrice` o `factoryCostTotal` enviado por el cliente cuando contradice la regla de líneas (rechazo Zod o ignorancia por merge).
- Advertencias “solo log” — eliminadas; la persistencia alinea o la API rechaza.

## 2. Rol de `QuoteItem` en SaaS

- **Con líneas:** las líneas son la **base financiera EXW**. Cada línea se normaliza a `totalPrice = qty × unitCost × (1 + markup%/100)`; el cliente **no** puede fijar `totalPrice` de línea ni enviar `factoryCostTotal` junto con ítems (Zod).
- **Sin líneas:** la cabecera aporta el EXW (`factoryCostTotal`); el total sigue saliendo solo de `priceSaaSQuoteLayers`.

## 3. Regla para totales entrantes (API SaaS)

| Campo | Regla |
|--------|--------|
| `totalPrice` (body) | **Prohibido** en `POST` (Zod `.strict()` + refine). Eliminado del `PATCH`. |
| `factoryCostTotal` + `items` | **Prohibido** en create y patch (refine). |
| Persistencia | **Siempre** valores devueltos por `canonicalizeSaaSQuotePayload` en creación, duplicado y en `PATCH` cuando aplica recomputo. |

## 4. Read model canónico

**Entrada única:** `formatQuoteForSaaSApi` / `formatQuoteForSaaSApiWithSnapshot` / `toLegacySalesQuoteShape` (`packages/core/src/pricing/quote-read-model.ts`), derivados de `buildQuotePricingReadModel` → `priceSaaSQuoteLayers`.

Los handlers usan **`formatQuoteForSaaSApiWithSnapshot`**, que exige `tax_rules_snapshot_json` válido (ver [quote-tax-architecture.md](./quote-tax-architecture.md)). Sin snapshot → **422** (`QuoteMissingTaxSnapshotError`).

**Endpoints que lo usan:**

- `GET` lista y `GET` detalle SaaS (`/api/saas/quotes`, `/api/saas/quotes/[id]`).
- Respuesta `POST` creación SaaS.
- `PATCH` SaaS (respuesta).
- `GET` y `PATCH` legacy `/api/quotes/[id]` (compatibilidad; misma forma financiera + máscara partner).
- Lista ventas `GET /api/quotes` → `toLegacySalesQuoteShape` (snapshot obligatorio).

**Máscara partner:** un solo lugar (`maskFactoryExw` en `formatQuoteForSaaSApi` / `formatQuoteForSaaSApiWithSnapshot`): oculta EXW y capa post-VL; expone `basePriceForPartner` (= VL sobre EXW).

## 5. Separación de dominios

| Capa | Responsabilidad |
|------|------------------|
| `calculations.ts` | Primitivas matemáticas reutilizables. |
| `pricing/saas-layers.ts` | Orquestación **SaaS** (multiplicativa VL/partner). |
| `pricing/saas-quote-persist.ts` | Normalización de líneas + único camino a valores persistidos. |
| `pricing/index.ts` → `priceQuote` | Orquestación **wizard CSV/geometría** (FOB aditivo sobre fábrica — otro producto de cotización). |
| `quote-engine.ts` / `buildQuoteSnapshot` | Armado de snapshot wizard; no escribe cotización SaaS. |
| `services/quotes.ts` | Prisma: CRUD; `duplicateQuote` re-canonicaliza antes de crear. |
| Rutas `apps/web/.../api/**` | Adaptadores delgados: tenant, Zod, `resolveTaxRulesForSaaSQuote` + `canonicalize` / `formatQuoteForSaaSApiWithSnapshot`. |
| `services/quote-tax-rules.ts` | Resolución única de reglas (proyecto → país → TaxRuleSet); snapshot en quote. |

## 6. Legacy

- **`/api/quotes`**: lista enriquecida para ventas; **no** recalcula por su cuenta — delega en `toLegacySalesQuoteShape`.
- **`/api/quotes/[id]`**: solo notas/estado en `PATCH`; lecturas alineadas al read model SaaS.
- **Wizard** (cuando exista flujo completo hacia otra ruta): sigue siendo dominio **distinto** (additive FOB); no se mezcla con el stack SaaS persistido.

## 7. Riesgos residuales

- Cotizaciones sin snapshot tras migración: la API devuelve **422** hasta ejecutar `pnpm run backfill:quote-tax-snapshots backfill` o guardar de nuevo con recomputo.
- Filas que el backfill marca **FAIL** (sin país o sin `TaxRuleSet`) requieren intervención manual en proyecto o catálogo fiscal antes de poder alinearlas.

## 8. Documentación relacionada

**Impuestos, backfill, verify:** [quote-tax-architecture.md](./quote-tax-architecture.md).

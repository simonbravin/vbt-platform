# Fase C — Consistencia de pricing y cotizaciones

Objetivo: una sola definición matemática para el **stack SaaS** (EXW → Vision Latam → partner → logística/import → CIF → impuestos opcionales → total sugerido), sin romper el **wizard CSV** (`priceQuote` + `quote-engine` con comisión aditiva sobre fábrica).

## 1. Rutas de cálculo (auditoría)

| Ruta | Qué calcula | Notas |
|------|-------------|--------|
| `packages/core/src/calculations.ts` | `computeLinePrice`, `computeFob` (aditivo), `computeCif`, `computeTaxLines` | Primitivas compartidas |
| `packages/core/src/quote-engine.ts` → `buildQuoteSnapshot` | Fábrica por CSV/M² + FOB = fábrica + % comisión + fija en taxes | **Distinto** del stack multiplicativo SaaS |
| `packages/core/src/pricing/index.ts` → `priceQuote` | Líneas + `computeFob` + CIF + impuestos | Canónico para **geometría / CSV** |
| `packages/core/src/pricing/saas-layers.ts` → `priceSaaSQuoteLayers` | EXW × (1+VL%) × (1+partner%) + `computeCif` + import + `computeTaxLines` | Canónico para **headers SaaS** |
| `POST /api/saas/quotes` | Persistencia + comparación / relleno de totales | Ver abajo |
| `GET /api/saas/quotes`, `GET/PATCH .../[id]` | `formatQuoteForSaaSApiWithSnapshot` | `pricing` + enmascarado partner |
| `GET /api/quotes` (legacy lista ventas) | `toLegacySalesQuoteShape` | Mismas capas que SaaS + campos legacy (`factoryCostUsd`, `fobUsd`, …) |

### Inconsistencias conocidas (no eliminadas aún)

- **Wizard / `priceQuote`**: comisión **aditiva** sobre subtotal de fábrica (`computeFob`).
- **SaaS persistido**: VL y partner **multiplicativos** en cadena — alineado con lo que el partner ve como “costo base” (EXW+VL) y su margen encima.
- Lista legacy `taxesFeesUsd` sigue siendo solo **servicio técnico** para compatibilidad con New Sale; el bloque `pricing` expone `ruleTaxesUsd` y `suggestedLandedUsd` completos.

## 2. Fachada ampliada (`@vbt/core`)

- **`priceQuote`**: sin cambios de contrato; sigue siendo el punto de entrada para líneas.
- **`priceSaaSQuoteLayers`**: stack completo SaaS usando solo `calculations` (`computeCif`, `computeTaxLines`, `sumTaxLines`).
- **Config comercial por partner (SaaS)**: implementado en `resolvePartnerPricingConfig` y documentado en [partner-pricing-config.md](./partner-pricing-config.md).
- **`QuotePricingContextMeta`**, **`PartnerPricingConfig`**: tipo legado / hint; la resolución efectiva usa `ResolvedPartnerPricingConfig`.

- **`buildQuotePricingReadModel`**, **`formatQuoteForSaaSApi`**, **`formatQuoteForSaaSApiWithSnapshot`**, **`toLegacySalesQuoteShape`**: lectura unificada.
- **`validateQuoteTotals`**: advertencias (ítems vs `factoryCostTotal`, `totalPrice` vs `suggestedLandedUsd`).
- **`estimateFactoryExwFromQuoteItems`**: fábrica desde ítems si el cliente no envía `factoryCostTotal`.

## 3. `POST /api/saas/quotes` (modo seguro)

- Calcula `priceSaaSQuoteLayers` con `visionLatamMarkupPct` resuelto.
- Si viene `totalPrice` y difiere de `suggestedLandedUsd` → **`console.warn`** (no bloquea).
- Si **no** viene `totalPrice` y hay fábrica efectiva (> 0) → persiste `totalPrice = suggestedLandedUsd`.
- Si no viene `factoryCostTotal` pero hay ítems → persiste fábrica estimada desde ítems.
- Tras crear: **`validateQuoteTotals`** → solo logs.

## 4. Partner — visibilidad (requisito de negocio)

- El partner **no** ve EXW ni el desglose VL; ve **`basePriceForPartner`** = EXW × (1 + VL%) (resultado único, no la fórmula).
- Su **% de margen** (`partnerMarkupPct`) se aplica **después** sobre esa base (multiplicativo), igual que en el stack SaaS.

## 5. Pendiente (siguientes iteraciones)

- Lectura vía `formatQuoteForSaaSApiWithSnapshot` / snapshot obligatorio; backfill: `pnpm run backfill:quote-tax-snapshots`.
- PATCH SaaS: opcionalmente mismas comparaciones que POST cuando cambien totales.
- Convergencia wizard → stack SaaS o documentar explícitamente dos mundos (línea vs header).

Ver también [saas-api-canonical.md](./saas-api-canonical.md) y [phase-b-architecture.md](./phase-b-architecture.md).

# Partner pricing configuration (SaaS quotes)

This document matches the implementation in `@vbt/core` (pricing resolution + SaaS quote APIs).

## Data model

### Where config lives

| Layer | Storage | Purpose |
|--------|---------|---------|
| Platform | `platform_config.config_json.pricing` | Fallback VL commission % (`visionLatamCommissionPct`, default **20**), optional `defaultMarginMinPct` / `defaultMarginMaxPct` for any partner without explicit bounds |
| Partner (structured) | `partner_profiles.margin_min_pct`, `margin_max_pct`, `vision_latam_commission_pct` | Query-friendly bounds and per-partner VL commission override (same semantics as today’s `getVisionLatamCommissionPctForOrg`) |
| Partner (JSON) | `partner_profiles.quote_defaults` | **Canonical extension point** for SaaS quote defaults: `defaultPartnerMarkupPct`, default logistics/import/local/technical USD amounts, optional `countryOverrides` (ISO2 → partial overrides). Coexists with legacy wizard keys (`baseUom`, `commissionPct`, …) used by `/api/admin/settings`. |

We **did not** add new Prisma columns: country-specific behavior and SaaS fee defaults use `quote_defaults` so the shape can evolve without repeated migrations.

### TypeScript types

- `PartnerQuoteDefaultsJson`, `CountryQuotePricingOverride` — `packages/core/src/pricing/partner-pricing-resolution.ts`
- `ResolvedPartnerPricingConfig` — fully resolved policy for one `(organizationId, projectCountryCode)` pair

## Resolution flow

1. `resolvePartnerPricingConfig(prisma, { organizationId, projectCountryCode })` loads partner profile + platform fallback.
2. Parses `quote_defaults` with `parsePartnerQuoteDefaultsJson`.
3. Applies optional `countryOverrides[country]` (keys normalized to uppercase) on top of org-wide defaults.
4. Computes:
   - `effectiveVisionLatamMarkupPct`: country override `visionLatamMarkupPct` if set, else `getVisionLatamCommissionPctForOrg` (partner column → platform JSON → 20).
   - Default partner markup and fee USD amounts from merged JSON + country override.
   - `allowedPartnerMarkupMinPct` / `allowedPartnerMarkupMaxPct`: partner columns if set, else platform `defaultMarginMinPct` / `defaultMarginMaxPct`, else `null` (no clamp).

## Precedence rules

### Creating a quote (`POST /api/saas/quotes`)

`resolveSaaSQuotePricingForCreate` applies:

1. **System / platform** — VL and margin bounds fallbacks when partner fields are null.
2. **Partner** — profile columns + `quote_defaults` (+ country override for the project’s `countryCode`).
3. **Explicit request body** — where allowed:
   - **`visionLatamMarkupPct`**: only **platform superadmin** may set; non-superadmin values are ignored; otherwise effective VL from step 1–2.
   - **`partnerMarkupPct`**, **logistics/import/local/technical**: if present in the body, they replace the partner default for that field; **partner markup is then clamped** to min/max policy.

Persisted totals still flow only through `canonicalizeSaaSQuotePayload` → `priceSaaSQuoteLayers` (single formula path).

### Updating a quote (`PATCH /api/saas/quotes/[id]`)

- Merge semantics are unchanged (`mergeSaaSQuotePatchIntoSource`).
- **Vision Latam %** remains whatever the merged row / superadmin patch dictates (historical quote; no forced reset to “current partner default”).
- **Partner markup %** is **re-clamped** on every pricing recompute to current min/max so policy tightening applies to edits.

### Duplicating a quote

- VL and line economics are copied from the source quote.
- **Partner markup %** is re-clamped to current policy before persist.

## Admin surface (foundation)

- **Superadmin** already uses `PATCH /api/saas/partners/[id]` for partner parameters. This API now accepts optional `quotePricingDefaults` (validated Zod object) merged into `quote_defaults`.
- **Partner org admins** continue to use `PATCH /api/admin/settings` for wizard-oriented keys (`baseUom`, `commissionPct`, …). Extending that route with the same SaaS default fields is optional future work to avoid two editors for the same JSON.

## File map

| Area | File |
|------|------|
| Resolver + merge helpers | `packages/core/src/pricing/partner-pricing-resolution.ts` |
| Platform fallbacks | `packages/core/src/services/platform-config.ts` (`getPlatformPricingFallback`) |
| SaaS create | `apps/web/src/app/api/saas/quotes/route.ts` |
| SaaS patch | `apps/web/src/app/api/saas/quotes/[id]/route.ts` |
| Duplicate | `packages/core/src/services/quotes.ts` |
| Partner PATCH | `apps/web/src/app/api/saas/partners/[id]/route.ts`, `packages/core/src/services/partners.ts` |

## Risks

- **Tightening min/max** can change totals on PATCH/duplicate when markup is clamped; intentional for policy enforcement.
- **`countryOverrides` JSON** is powerful; malformed data is sanitized by `parsePartnerQuoteDefaultsJson` (non-finite numbers dropped).

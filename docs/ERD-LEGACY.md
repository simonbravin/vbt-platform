# ERD – Legacy (no refleja el schema actual)

**Nota:** Este documento describe una estructura antigua (Org, UserStatus, Sale, etc.) y **no refleja el schema actual** de Partner SaaS. Se conserva como referencia histórica. Para el schema actual véase `packages/db/prisma/schema.prisma` y `docs/ERD-GAP-ANALYSIS.md`.

---

# ERD – Estructura actual (reverse engineered)

Documento generado a partir de `packages/db/prisma/schema.prisma`. Sirve como base para evaluar el estado actual y lo que falta para multi-tenant (cada partner ve solo sus clientes, cotizaciones, presupuestos, ventas; superadmin ve todo).

---

## Resumen ejecutivo

- **Tenant actual:** La entidad **Org** actúa como tenant. Casi todo lo operativo está ligado a **`organization_id`** (DB) / **`organizationId`** (Prisma): Client, Project, Quote, Sale, Warehouse, CountryProfile, FreightRateProfile, TaxRuleSet, BillingEntity, Payment, AuditLog, RevitImport. Convención única: en la base de datos la columna es siempre `organization_id` (snake_case).
- **Global (sin organization_id):** User, SystemType, PieceCatalog, PieceCost. Son datos de catálogo o usuarios del sistema.
- **Híbrido:** PieceAlias tiene `organization_id` opcional (alias por org o global).
- **Rol:** OrgMember tiene `OrgMemberRole`: SUPERADMIN, ADMIN, SALES, VIEWER. Hoy no está modelado si SUPERADMIN es "plataforma" o "por org"; para multi-tenant hará falta distinguir superadmin de plataforma vs roles por partner.

---

## Enums

| Enum | Valores |
|------|---------|
| **UserStatus** | PENDING, ACTIVE, REJECTED, SUSPENDED |
| **OrgMemberRole** | SUPERADMIN, ADMIN, SALES, VIEWER |
| **BaseUom** | M, FT |
| **WeightUom** | KG, LBS |
| **CostMethod** | CSV, M2_BY_SYSTEM, M2_TOTAL |
| **QuoteStatus** | DRAFT, SENT, ARCHIVED, CANCELLED |
| **ProjectStatus** | DRAFT, IN_CONVERSATION, QUOTED, QUOTE_SENT, SOLD, ARCHIVED |
| **SaleStatus** | DRAFT, CONFIRMED, PARTIALLY_PAID, PAID, DUE, CANCELLED |
| **InvMoveType** | IN, OUT, TRANSFER, ADJUST, RESERVE, RELEASE |
| **AuditAction** | (varios: USER_*, COST_*, TAX_*, QUOTE_*, INV_MOVE, CATALOG_*, PROJECT_*, SALE_*, PAYMENT_*) |
| **SystemCode** | S80, S150, S200 |
| **TaxBase** | CIF, FOB, BASE_IMPONIBLE, FIXED_PER_CONTAINER, FIXED_TOTAL |
| **MarkupType** | PERCENT, FIXED_USD, BOTH |

---

## Diagrama de entidades y relaciones (texto)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ ORG (tenant)                                                                                  │
│ id, name, slug, baseUom, weightUom, minRunFt, rateS80/S150/S200/Global, commissionPct/Fixed   │
└───┬─────────────────────────────────────────────────────────────────────────────────────────┘
    │
    ├──► OrgMember (organization_id, userId, role) ◄── User (id, email, name, passwordHash, status)
    ├──► Client (organization_id, name, legalName, taxId, address, city, countryId, …)
    ├──► Project (organization_id, clientId?, name, status, baselineQuoteId?, soldAt, finalAmountUsd, …)
    ├──► Quote (organization_id, projectId, countryId?, status, factoryCostUsd, commissionPct/Fixed, …)
    ├──► Warehouse (organization_id, name, location)
    ├──► CountryProfile (organization_id, code, name, currency)
    ├──► FreightRateProfile (organization_id, countryId, freightPerContainer, …)
    ├──► TaxRuleSet (organization_id, countryId, name, rules JSON)
    ├──► BillingEntity (organization_id, name, slug)
    ├──► Sale (organization_id, clientId, projectId, quoteId?, status, exwUsd, commissionPct, …)
    ├──► Payment (organization_id, saleId, entityId, amountUsd, paidAt, …)
    ├──► RevitImport (organization_id, projectId?, filename, status, …)
    └──► AuditLog (organization_id?, userId?, action, entityType, entityId, meta)

Client ──► CountryProfile (countryId)
Project ──► Client (clientId), CountryProfile (countryId), Quote (baselineQuoteId)
Quote ──► Project, CountryProfile, User (createdBy), FreightRateProfile?
Quote ──► QuoteLine, QuoteTaxLine, QuoteDoc
Sale ──► Client, Project, Quote?, User (createdBy)
Sale ──► SaleInvoice ──► BillingEntity
Payment ──► Sale, BillingEntity, User (createdBy)

Warehouse ──► InventoryItem (warehouseId, pieceId, qtyOnHand, qtyReserved, qtyAvailable)
InventoryItem ──► PieceCatalog
InventoryMove ──► InventoryItem, Warehouse (from/to), quoteId?

RevitImport ──► Project?
RevitImport ──► RevitImportLine ──► PieceCatalog (pieceId)

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL (sin organization_id)                                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ User (id, email, name, passwordHash, status)                                                 │
│ SystemType (code SystemCode, name, thicknessMm, concreteM3PerM2, steelKgPerM2)              │
│ PieceCatalog (systemId?, dieNumber?, canonicalName, systemCode?, usefulWidthMm, …)          │
│ PieceCost (pieceId, effectiveFrom, pricePer5000ftCored, pricePerFtCored, pricePerMCored, …)  │
│ PieceAlias (organization_id?, pieceId, aliasRaw, aliasNormalized, source)  ← opcional      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

PieceCatalog ──► SystemType (systemId)
PieceCatalog ──► PieceCost, PieceAlias, RevitImportLine, InventoryItem
```

---

## Tablas y atributos (detalle)

(Véase el archivo original en historial de git si se necesita el detalle completo. Resumen: orgs, users, org_members, audit_logs, clients, projects, country_profiles, freight_rate_profiles, tax_rule_sets, quotes, quote_lines, warehouses, inventory_items, sales, etc. — estructura pre–Partner SaaS.)

# ERD – Estructura actual (reverse engineered)

Documento generado a partir de `packages/db/prisma/schema.prisma`. Sirve como base para evaluar el estado actual y lo que falta para multi-tenant (cada partner ve solo sus clientes, cotizaciones, presupuestos, ventas; superadmin ve todo).

---

## Resumen ejecutivo

- **Tenant actual:** La entidad **Org** actúa como tenant. Casi todo lo operativo está ligado a **`organization_id`** (DB) / **`organizationId`** (Prisma): Client, Project, Quote, Sale, Warehouse, CountryProfile, FreightRateProfile, TaxRuleSet, BillingEntity, Payment, AuditLog, RevitImport. Convención única: en la base de datos la columna es siempre `organization_id` (snake_case).
- **Global (sin organization_id):** User, SystemType, PieceCatalog, PieceCost. Son datos de catálogo o usuarios del sistema.
- **Híbrido:** PieceAlias tiene `organization_id` opcional (alias por org o global).
- **Rol:** OrgMember tiene `OrgMemberRole`: SUPERADMIN, ADMIN, SALES, VIEWER. Hoy no está modelado si SUPERADMIN es “plataforma” o “por org”; para multi-tenant hará falta distinguir superadmin de plataforma vs roles por partner.

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

### Org & usuarios

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **orgs** | id, name, slug, baseUom, weightUom, minRunFt, rateS80, rateS150, rateS200, rateGlobal, commissionPct, commissionFixed, createdAt, updatedAt | 1:N con OrgMember, Client, Project, Quote, Warehouse, CountryProfile, FreightRateProfile, TaxRuleSet, RevitImport, AuditLog, BillingEntity, Sale, Payment |
| **users** | id, email, name, passwordHash, status (UserStatus), createdAt, updatedAt | N:M con Org vía OrgMember; 1:N Quote (createdBy), AuditLog, Sale (createdBy), Payment (createdBy) |
| **org_members** | id, organization_id, userId, role (OrgMemberRole), createdAt, updatedAt | N:1 Org, N:1 User. UNIQUE(organization_id, userId) |
| **audit_logs** | id, organization_id?, userId?, action, entityType?, entityId?, meta (JSON), createdAt | N:1 Org, N:1 User |

### Clientes y proyectos

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **clients** | id, organization_id, name, legalName, taxId, address, city, countryId, phone, email, website, notes, createdAt, updatedAt | N:1 Org, N:1 CountryProfile; 1:N Project, Sale |
| **projects** | id, organization_id, name, client?, clientId?, location, countryId?, description, wallAreaM2*, kitsPerContainer, numContainers, totalKits, plannedStartDate, durationWeeks, isArchived, status (ProjectStatus), baselineQuoteId?, soldAt?, finalAmountUsd?, createdAt, updatedAt | N:1 Org, N:1 Client, N:1 CountryProfile, N:1 Quote (baseline); 1:N RevitImport, Quote, Sale |

### Catálogo y costos (global)

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **system_types** | id, code (SystemCode), name, thicknessMm, concreteM3PerM2, steelKgPerM2, createdAt, updatedAt | 1:N PieceCatalog |
| **piece_catalog** | id, systemId?, dieNumber?, canonicalName, canonicalNameNormalized, categoryRaw?, systemCode?, usefulWidthMm/M?, lbsPerM*, volumePerM?, isActive, createdAt, updatedAt | N:1 SystemType; 1:N PieceCost, PieceAlias, RevitImportLine, InventoryItem |
| **piece_costs** | id, pieceId, effectiveFrom, pricePer5000ftCored, pricePerFtCored, pricePerMCored, minRunFtOverride?, notes, createdAt, updatedAt | N:1 PieceCatalog |
| **piece_aliases** | id, organization_id?, pieceId, aliasRaw, aliasNormalized, source?, createdAt | N:1 PieceCatalog. UNIQUE(aliasNormalized, pieceId). organization_id opcional → alias por org o global |

### Países, flete e impuestos (por org)

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **country_profiles** | id, organization_id, code, name, currency, isActive, createdAt, updatedAt | N:1 Org; 1:N Client, FreightRateProfile, TaxRuleSet, Project, Quote. UNIQUE(organization_id, code) |
| **freight_rate_profiles** | id, organization_id, countryId, name, freightPerContainer, isDefault, validFrom, expiryDate?, notes, createdAt, updatedAt | N:1 Org, N:1 CountryProfile |
| **tax_rule_sets** | id, orgId, countryId, name, isActive, rules (JSON), createdAt, updatedAt | N:1 Org, N:1 CountryProfile |

### Cotizaciones (Quotes)

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **quotes** | id, organization_id, projectId, countryId?, quoteNumber?, status (QuoteStatus), costMethod, revitImportId?, warehouseId?, reserveStock, baseUom, factoryCostUsd, commissionPct, commissionFixed, fobUsd, freightProfileId?, freightCostUsd, numContainers, kitsPerContainer, totalKits, cifUsd, taxesFeesUsd, landedDdpUsd, concreteM3, steelKgEst, wallAreaM2*, totalWeightKg, totalVolumeM3, snapshot?, sentAt?, sentTo?, notes?, createdBy?, createdAt, updatedAt | N:1 Org, Project, CountryProfile, User (createdBy); 1:N QuoteLine, QuoteTaxLine, QuoteDoc; 1:1 Project (baselineQuote); 1:N Sale |
| **quote_lines** | id, quoteId, lineNum, description, pieceId?, systemCode?, qty, heightMm?, linearM/Ft?, m2Line?, uom?, unitPrice?, markupPct, lineTotal, weightKg*, volumeM3?, isBelowMinRun, productionNeeded?, isManualOverride, createdAt | N:1 Quote. ON DELETE CASCADE |
| **quote_tax_lines** | id, quoteId, order, label, base (TaxBase), ratePct?, fixedAmount?, baseAmount, computedAmount, perContainer, notes?, createdAt | N:1 Quote. ON DELETE CASCADE |
| **quote_docs** | id, quoteId, type, url?, storagePath?, emailTo?, emailMessageId?, generatedAt, meta? | N:1 Quote. ON DELETE CASCADE |

### Revit

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **revit_imports** | id, organization_id, projectId?, filename, uploadedBy?, rowCount, matchedCount, unmappedCount, status, createdAt, updatedAt | N:1 Org, N:1 Project; 1:N RevitImportLine |
| **revit_import_lines** | id, importId, rowNum, rawPieceCode?, rawPieceName, rawQty, rawHeightMm, pieceId?, matchMethod?, isIgnored, linearM/Ft?, m2Line?, weight*, volumeM3?, pricePerM/Ft?, lineTotal?, markupPct?, lineTotalWithMarkup?, createdAt, updatedAt | N:1 RevitImport, N:1 PieceCatalog |

### Inventario

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **warehouses** | id, organization_id, name, location?, isActive, createdAt, updatedAt | N:1 Org; 1:N InventoryItem, InventoryMove (from/to) |
| **inventory_items** | id, warehouseId, pieceId, heightMm?, qtyOnHand, qtyReserved, qtyAvailable, minStockAlert?, createdAt, updatedAt | N:1 Warehouse, N:1 PieceCatalog; 1:N InventoryMove. UNIQUE(warehouseId, pieceId, heightMm) |
| **inventory_moves** | id, itemId, fromWarehouseId?, toWarehouseId?, type (InvMoveType), qty, quoteId?, notes?, performedBy?, createdAt | N:1 InventoryItem, N:1 Warehouse (from/to) |

### Ventas (Sales)

| Tabla | Atributos principales | Relaciones |
|-------|------------------------|------------|
| **billing_entities** | id, organization_id, name, slug, isActive, createdAt, updatedAt | N:1 Org; 1:N SaleInvoice, Payment. UNIQUE(organization_id, slug) |
| **sales** | id, organization_id, clientId, projectId, quoteId?, saleNumber?, quantity, status (SaleStatus), exwUsd, commissionPct, commissionAmountUsd, fobUsd, freightUsd, cifUsd, taxesFeesUsd, landedDdpUsd, invoicedBasis?, taxBreakdownJson?, notes?, createdBy?, createdAt, updatedAt | N:1 Org, Client, Project, Quote?, User (createdBy); 1:N SaleInvoice, Payment. UNIQUE(organization_id, saleNumber) |
| **sale_invoices** | id, saleId, entityId, amountUsd, dueDate?, sequence, referenceNumber?, notes?, createdAt, updatedAt | N:1 Sale (CASCADE), N:1 BillingEntity |
| **payments** | id, organization_id, saleId, entityId, amountUsd, amountLocal?, currencyLocal?, exchangeRate?, paidAt, notes?, createdBy?, createdAt | N:1 Org, Sale (CASCADE), BillingEntity, User (createdBy) |

---

## Índices relevantes (del schema)

- org_members: (organization_id, userId) UNIQUE
- clients: organization_id, countryId, name
- projects: organization_id, clientId, countryId, status, soldAt
- quotes: organization_id, projectId
- sales: organization_id, clientId, projectId, status, createdAt; (organization_id, saleNumber) UNIQUE
- country_profiles: (organization_id, code) UNIQUE
- billing_entities: (organization_id, slug) UNIQUE
- audit_logs: organization_id, userId, action
- piece_aliases: (aliasNormalized, pieceId) UNIQUE, aliasNormalized  
- inventory_items: (warehouseId, pieceId, heightMm) UNIQUE  

---

## Estado respecto a multi-tenant

### Ya alineado con “un tenant = una Org”

- **Client, Project, Quote, Sale, Payment, BillingEntity:** todos con `organization_id` (DB) / `organizationId` (Prisma) → cada partner (org) ve solo los suyos filtrando por org.
- **Warehouse, CountryProfile, FreightRateProfile, TaxRuleSet, RevitImport:** por org.
- **AuditLog:** tiene `organization_id` opcional; se puede seguir filtrando por org para partners.

### Aclaraciones pendientes para multi-tenant

1. **User y OrgMember**  
   - Hoy: User es global; OrgMember asocia User a Org con un rol.  
   - Falta definir: ¿un mismo User puede pertenecer a varias Orgs (varios partners)? Si sí, el “tenant actual” en sesión sería la Org elegida.  
   - Para superadmin: definir si hay un flag en User (ej. `isPlatformSuperadmin`) o si SUPERADMIN en alguna Org especial significa “ve todo”. Eso definirá si el superadmin ve “todas las Orgs” o “una Org con privilegios especiales”.

2. **Catálogo y costos**  
   - **PieceCatalog** y **PieceCost** son globales (sin organization_id).  
   - Implicación: todos los partners comparten el mismo catálogo y los mismos costos base (factory).  
   - Si en el futuro quieres “factory cost + comisión por partner”, ya tienes en **Org** `commissionPct` y `commissionFixed`, y en **Quote** y **Sale** campos de comisión. Falta (para más adelante) limitar comisión del partner (ej. máx 20%) y posiblemente un concepto explícito de “precio base para el partner” (factory + comisión plataforma).

3. **PieceAlias**  
   - Tiene `orgId` opcional: alias por org o global. Para multi-tenant está bien: cada partner puede tener sus propios alias sin afectar a otros.

4. **Filtro en APIs y UI**  
   - Para que “cada partner vea solo lo suyo”, hay que asegurar que todas las consultas de Client, Project, Quote, Sale, etc. filtren por `organization_id` (o `activeOrgId` en sesión) según la Org del usuario en sesión (y que el superadmin, cuando esté definido, pueda omitir o ampliar ese filtro).

---

## Siguientes pasos sugeridos (sin implementar aún)

1. Definir modelo de “superadmin de plataforma” (user global vs rol en Org especial vs flag en User).  
2. Definir si un User puede ser miembro de varias Orgs y cómo se elige la Org activa.  
3. Cuando toque la parte comercial: campo o regla para “comisión máxima del partner” (ej. 20%) y dónde guardarla (Org o tabla de configuración por partner).  
4. Revisar todas las rutas/APIs que lean Client, Project, Quote, Sale, etc. y garantizar el filtro por `organization_id` / `activeOrgId` (y excepción controlada para superadmin).

---

*Generado por reverse engineering de `packages/db/prisma/schema.prisma`.*

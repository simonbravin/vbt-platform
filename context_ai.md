# VBT Cotizador — AI Context Reference

> **Propósito:** Documento de referencia completo para que cualquier IA (o desarrollador) pueda entender la aplicación, su arquitectura, modelos de datos, flujos y convenciones sin necesidad de explorar el código fuente.

---

## 1. Visión General

**VBT Cotizador** es una plataforma SaaS B2B para **Vision Building Technologies (VBT)**. Su función principal es generar cotizaciones de exportación de paneles de muros prefabricados de concreto (sistemas VBT 80mm, 150mm y 200mm) para proyectos de construcción en Latinoamérica.

### Flujo principal de negocio

```
Proyecto → Importar CSV de Revit → Mapear piezas → Cotizar → Enviar por email / PDF
```

1. Un usuario crea un **Proyecto** y sube un CSV exportado desde Revit con el listado de piezas del edificio.
2. El sistema parsea el CSV y hace **matching automático** contra el catálogo de piezas.
3. En el **Wizard de Cotización** de 6 pasos se calcula:
   - Costo de fábrica (por pieza desde catálogo, o por m² de muro por sistema)
   - Comisión de Vision Latam (% + fijo por orden)
   - Flete (por contenedor, según perfil de país)
   - Impuestos y aranceles del país destino
4. Se guarda la cotización como DRAFT y se puede enviar por email o descargar como PDF.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Monorepo | **pnpm workspaces** + Turborepo |
| Frontend / Backend | **Next.js 14.2.5** (App Router, RSC + Client Components) |
| Base de datos | **PostgreSQL** vía **Neon** (serverless) |
| ORM | **Prisma 5.10.2** |
| Auth | **NextAuth 4.24.7** (JWT, Credentials provider) |
| UI | **Tailwind CSS** + shadcn/ui (Radix UI primitives) |
| Validación | **Zod** |
| CSV parsing | **PapaParse** |
| PDF | **@react-pdf/renderer** |
| Email | **Resend** |
| Cálculos | Librería interna `@vbt/core` |
| Testing | **Vitest** (en `packages/core`) |
| Lenguaje | **TypeScript** en todo el monorepo |

### Colores de marca (Tailwind)

```
vbt-blue   → #1A3A6B  (azul marino corporativo)
vbt-orange → #F97316  (naranja acción)
```

---

## 3. Estructura del Monorepo

```
VBT_Cotizador/
├── apps/
│   └── web/                          # App Next.js (puerto 3000)
│       ├── .prisma/client/           # Prisma client generado (output del schema)
│       ├── src/
│       │   ├── app/                  # Next.js App Router
│       │   │   ├── (auth)/           # Páginas públicas: login, signup, pending
│       │   │   ├── (dashboard)/      # Páginas protegidas (layout con sidebar)
│       │   │   └── api/              # Route Handlers REST
│       │   ├── components/
│       │   │   ├── quotes/           # 6 componentes del wizard de cotización
│       │   │   ├── layout/           # Sidebar + Topbar
│       │   │   ├── pdf/              # Componente PDF con @react-pdf
│       │   │   └── ui/               # shadcn/ui components
│       │   └── lib/
│       │       ├── auth.ts           # Configuración NextAuth
│       │       ├── db.ts             # Re-export del cliente Prisma
│       │       ├── audit.ts          # Helper de auditoría
│       │       └── utils.ts          # generateQuoteNumber, etc.
│       ├── tailwind.config.ts
│       ├── next.config.js            # transpilePackages: ['@vbt/core','@vbt/db']
│       └── .env.local
│
├── packages/
│   ├── core/                         # @vbt/core — lógica de negocio pura
│   │   └── src/
│   │       ├── calculations.ts       # Todas las funciones de cálculo
│   │       ├── csv-parser.ts         # Parser de CSV de Revit + matching de piezas
│   │       ├── normalizer.ts         # Normalización de nombres de piezas
│   │       ├── quote-engine.ts       # Ensamblador del QuoteSnapshot
│   │       └── index.ts              # Barrel export
│   │
│   └── db/                           # @vbt/db — acceso a base de datos
│       ├── prisma/
│       │   ├── schema.prisma         # Schema completo (ver sección 4)
│       │   └── seed.ts               # Script de seed inicial
│       └── src/
│           └── index.ts              # Prisma client singleton (con logging dev)
│
└── package.json                      # Workspace root (pnpm)
```

---

## 4. Schema de Base de Datos (ERD)

La base de datos es **PostgreSQL** con Prisma. El cliente se genera en `apps/web/.prisma/client`.

### Enums

```prisma
enum UserStatus       { PENDING | ACTIVE | REJECTED | SUSPENDED }
enum OrgMemberRole    { SUPERADMIN | ADMIN | SALES | VIEWER }
enum BaseUom          { M | FT }
enum WeightUom        { KG | LBS }
enum CostMethod       { CSV | M2_BY_SYSTEM | M2_TOTAL }
enum QuoteStatus      { DRAFT | SENT | ARCHIVED | CANCELLED }
enum InvMoveType      { IN | OUT | TRANSFER | ADJUST | RESERVE | RELEASE }
enum SystemCode       { S80 | S150 | S200 }
enum TaxBase          { CIF | FOB | BASE_IMPONIBLE | FIXED_PER_CONTAINER | FIXED_TOTAL }
enum MarkupType       { PERCENT | FIXED_USD | BOTH }
enum AuditAction      { USER_APPROVED | USER_REJECTED | ... | QUOTE_* | INV_MOVE | PROJECT_* | SALE_CREATED | SALE_UPDATED | PAYMENT_RECORDED }
enum SaleStatus       { DRAFT | CONFIRMED | PARTIALLY_PAID | PAID | CANCELLED }
```

### Modelos — Relaciones resumidas

```
Org ──< OrgMember >── User
Org ──< Project ──< RevitImport ──< RevitImportLine >── PieceCatalog
Org ──< Quote ──< QuoteLine
              ──< QuoteTaxLine
              ──< QuoteDoc
Org ──< BillingEntity
Org ──< Sale ──< SaleInvoice >── BillingEntity
          ──< Payment >── BillingEntity
Sale >── Client, Project, Quote?
Org ──< Warehouse ──< InventoryItem >── PieceCatalog
                  ──< InventoryMove
Org ──< CountryProfile ──< FreightRateProfile
                       ──< TaxRuleSet
PieceCatalog ──< PieceCost
             ──< PieceAlias
PieceCatalog >── SystemType
```

### Modelo: `Org`
Organización (tenant). Almacena defaults de tasas y configuración.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | cuid | PK |
| `name` / `slug` | String | slug único |
| `baseUom` | BaseUom | M (default) |
| `minRunFt` | Float | 5000 ft — producción mínima por pieza |
| `rateS80` | Float | USD/m² para VBT 80mm (default 37) |
| `rateS150` | Float | USD/m² para VBT 150mm (default 67) |
| `rateS200` | Float | USD/m² para VBT 200mm (default 85) |
| `rateGlobal` | Float | USD/m² para M2_TOTAL (default 60) |
| `commissionPct` | Float | % de comisión default |
| `commissionFixed` | Float | Comisión fija default |

### Modelo: `User` + `OrgMember`
- `User` tiene `email`, `passwordHash`, `status` (PENDING → ACTIVE tras aprobación)
- `OrgMember` es la tabla pivote con el `role` del usuario en la org

### Modelo: `PieceCatalog`
Catálogo global de piezas (formas y liners de VBT).

| Campo | Tipo | Notas |
|-------|------|-------|
| `canonicalName` | String | Nombre sin prefijo SA####_ |
| `canonicalNameNormalized` | String | lowercase, sin puntuación — índice único para matching |
| `systemCode` | SystemCode? | S80, S150, S200 |
| `usefulWidthM` | Float? | Ancho útil en metros (para calcular m²) |
| `lbsPerMCored` | Float? | Peso lb/m con núcleo |
| `lbsPerMUncored` | Float? | Peso lb/m sin núcleo |
| `volumePerM` | Float? | Volumen m³/m lineal |

### Modelo: `PieceCost`
Historial de precios por pieza (última activa = `orderBy effectiveFrom desc, take 1`).

| Campo | Tipo | Notas |
|-------|------|-------|
| `pricePer5000ftCored` | Float? | Precio por 5000 pies (precio de fábrica VBT) |
| `pricePerFtCored` | Float? | Derivado: / 5000 |
| `pricePerMCored` | Float? | Derivado: pricePerFt / FT_TO_M |
| `minRunFtOverride` | Float? | Override de producción mínima |

**Conversión automática de precios:** Si solo se provee `pricePer5000ftCored`, los otros se derivan. Ver `derivePrices()` en `calculations.ts`.

### Modelo: `PieceAlias`
Nombres alternativos normalizados para matching. Índice en `aliasNormalized`.

### Modelo: `RevitImport` + `RevitImportLine`
Resultado del parsing de un CSV de Revit.

- `RevitImportLine` tiene los campos crudos (`rawPieceName`, `rawQty`, `rawHeightMm`) y los calculados (`linearM`, `m2Line`, `pricePerM`, etc.)
- `matchMethod`: `EXACT_CODE | ALIAS | CANONICAL | MANUAL | IGNORED`
- Las líneas matched tienen `pieceId` apuntando al `PieceCatalog`

### Modelo: `Quote`
Cotización completa con todos los agregados financieros.

| Campo | Notas |
|-------|-------|
| `costMethod` | CSV \| M2_BY_SYSTEM \| M2_TOTAL |
| `factoryCostUsd` | Costo de fábrica total |
| `commissionPct` / `commissionFixed` | Comisión Vision Latam |
| `fobUsd` | factoryCost + commission |
| `freightCostUsd` | Flete total (puede ser por contenedor × numContainers) |
| `cifUsd` | fob + freight |
| `taxesFeesUsd` | Suma de todos los QuoteTaxLine |
| `landedDdpUsd` | cif + taxes — **precio final entregado** |
| `snapshot` | JSON congelado del QuoteSnapshot al momento de guardar |
| `wallAreaM2S80/150/200/Total` | m² de muro por sistema |

### Modelo: `TaxRuleSet`
Conjunto de reglas de impuestos (JSON array de `TaxRule`) por país.

```typescript
// Estructura del JSON en TaxRuleSet.rules[]
interface TaxRule {
  order: number;         // Orden de aplicación (1, 2, 3...)
  label: string;         // "Import Duty", "IVA", etc.
  base: TaxBase;         // Sobre qué se calcula
  ratePct?: number;      // % (ej: 15 para 15%)
  fixedAmount?: number;  // Para FIXED_PER_CONTAINER o FIXED_TOTAL
  perContainer?: boolean;
  note?: string;
}
```

**Bases de cálculo:**
- `CIF` → `cifUsd * ratePct / 100`
- `FOB` → `fobUsd * ratePct / 100`
- `BASE_IMPONIBLE` → `(cifUsd + dutyTotal + statisticTotal) * ratePct / 100`
- `FIXED_PER_CONTAINER` → `fixedAmount * numContainers`
- `FIXED_TOTAL` → `fixedAmount`

### Ventas: monto facturado, cuotas y pagos (trazabilidad)
- **Monto total facturado (contractual)** = `getInvoicedAmount(sale)` según `invoicedBasis` (EXW/FOB/CIF/DDP) sobre los totales de la venta. Es la única fuente de verdad para "fully paid".
- **SaleInvoice** = cuotas/ítems de facturación con vencimiento (por entidad, sequence). Sirven para "qué vence cuándo" y para el status DUE; no redefinen el total facturado.
- **Payment** = cobros contra la venta (por entidad). No hay asignación a una SaleInvoice concreta; se compara suma total de pagos vs monto total facturado (basis) para PAID / PARTIALLY_PAID.
- **Status DUE**: la venta tiene al menos una SaleInvoice con `dueDate` &lt; hoy y no está PAID.

### Modelo: `BillingEntity`
Entidades de facturación por org (ej. Vision Latam SA, VBT Argentina SA). Se usan en SaleInvoice y Payment para indicar qué entidad emite la factura o recibe el pago.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | cuid | PK |
| `orgId` | String | FK Org |
| `name` | String | Nombre para mostrar |
| `slug` | String | Identificador único por org (ej. VISION_LATAM, VBT_ARGENTINA); único con orgId |
| `isActive` | Boolean | Si false, no aparece en dropdowns (ej. Add payment) |

Gestión: **Admin → Entities** (solo SUPERADMIN). GET lista para todos los usuarios; POST/PATCH/DELETE solo SUPERADMIN.

### Modelo: `InventoryItem` + `InventoryMove`
Inventario de piezas por warehouse. `qtyAvailable = qtyOnHand - qtyReserved`.

Tipos de movimiento: `IN` (recepción), `OUT` (despacho), `TRANSFER`, `ADJUST`, `RESERVE` (al crear cotización), `RELEASE`.

---

## 5. Librería `@vbt/core`

### `calculations.ts` — Funciones de cálculo

```typescript
// Constantes
M_TO_FT = 3.28084
FT_TO_M = 0.3048
LBS_TO_KG = 0.45359237

// Métricas de línea (desde qty + heightMm + propiedades de pieza)
computeLineMetrics(input) → { linearM, linearFt, m2Line, weightKg*, volumeM3 }
// linearM = qty × (heightMm / 1000)
// m2Line  = linearM × usefulWidthM

// Precio
derivePrices(cost)   → { pricePerFt, pricePerM }   // convierte entre UOMs
computeLinePrice(...)→ { unitPrice, lineTotal, lineTotalWithMarkup }

// Producción mínima
checkMinRun(linearFt, minRunFt) → { isBelowMinRun, productionNeeded }

// Costo de fábrica
computeFactoryCostBySystem({ m2S80, m2S150, m2S200, rateS80, rateS150, rateS200 }) → number
computeFactoryCostTotal(m2Total, globalRate) → number

// Cadena de precios
computeFob({ factoryCost, commissionPct, commissionFixed }) → { commissionAmount, fobUsd }
computeCif(fobUsd, freightCost) → number
computeTaxLines({ cifUsd, fobUsd, numContainers, rules }) → TaxLineResult[]
sumTaxLines(lines) → number

// Informacional
computeConcreteAndSteel({ m2S80, m2S150, m2S200, ...ratios }) → { concreteM3, steelKgEst }

// Default ratios (cuando no hay datos de la org):
//   concrete: S80=0.08, S150=0.15, S200=0.20 m³/m²
//   steel:    S80=4,    S150=6,    S200=8    kg/m²
```

### `normalizer.ts` — Normalización de nombres

```typescript
normalizeAliasRaw(raw: string): string
// 1. Strip prefijo Revit "FamilyName: TypeName" → toma lo que está después del ": "
// 2. Strip prefijo SA####_  (ej: SA2025_6in x 9in Form → "6in x 9in Form")
// 3. Lowercase
// 4. Reemplaza [^a-z0-9\s\-] por espacio
// 5. Colapsa espacios y trim
// Resultado: "6in x 9in form"
```

### `csv-parser.ts` — Parser de CSV de Revit

**Formatos de CSV soportados:**
- Revit table schedule export (separado por comas)
- Fila 0: puede ser título del proyecto (se detecta y salta)
- Fila 1: headers reales (`Type`, `QTY`, `Length`, `Volume`, etc.)
- Rows de subtotales: `"TypeName: 2034,,,"` — se filtran
- Rows de grand total: `"Grand total: 2487,,,"` — se filtran
- Rows completamente vacías: se filtran

**Headers reconocidos** (sinónimos en español/inglés/francés):
- `Type | piece name | element | perfil | tipo` → pieceName
- `count | quantity | qty | cantidad | number` → qty
- `height | length | alto | altura | longitud | largeur` → heightMm
- `piece code | code | mark | familia` → pieceCode (opcional)

**Algoritmo de matching** (en orden):
1. `EXACT_CODE` — por `rawPieceCode` contra alias normalized
2. `ALIAS` — `normalizeAliasRaw(rawPieceName)` == `alias.aliasNormalized`
3. `CANONICAL` — match contra `canonicalNameNormalized`
4. `UNMATCHED` — no encontrado

### `quote-engine.ts` — Ensamblador

```typescript
buildQuoteSnapshot(input: QuoteInput): QuoteSnapshot
```

Recibe todo el input y devuelve un snapshot completo con todos los agregados. Se usa tanto en el servidor (API `/api/quotes POST`) como referencia para los cálculos del wizard en el cliente.

**Flujo interno:**
1. Si `method === CSV`: procesa líneas, acumula m² por sistema, calcula precio por pieza
2. Calcula `factoryCostUsd` según el método (CSV / M2_BY_SYSTEM / M2_TOTAL)
3. `commissionAmount = factoryCost × commissionPct/100 + commissionFixed`
4. `fobUsd = factoryCost + commissionAmount`
5. `cifUsd = fobUsd + freightCostUsd`
6. Aplica `taxRules` → `taxLines[]` → `taxesFeesUsd`
7. `landedDdpUsd = cifUsd + taxesFeesUsd`

---

## 6. API Reference

Todas las rutas están bajo `/api/`. Autenticación via NextAuth session (cookie JWT). Cada handler verifica `getServerSession(authOptions)`.

**Headers de respuesta de error:**
```json
{ "error": "mensaje" }  →  status 400/401/403/404
```

### Auth
| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handler |
| POST | `/api/auth/signup` | Crea user con status PENDING; requiere aprobación de ADMIN |

### Proyectos
| Método | Ruta | Body / Query | Respuesta |
|--------|------|-------------|-----------|
| GET | `/api/projects` | `?search=&archived=` | Array de proyectos |
| POST | `/api/projects` | `{ name, client?, location?, description? }` | Proyecto creado |
| GET | `/api/projects/[id]` | — | Proyecto con revitImports y quotes |
| PATCH | `/api/projects/[id]` | Partial project | Proyecto actualizado |
| DELETE | `/api/projects/[id]` | — | 204 |

### Cotizaciones
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/api/quotes` | `?status=&projectId=` |
| POST | `/api/quotes` | Crea cotización + corre buildQuoteSnapshot en servidor |
| GET | `/api/quotes/[id]` | Include: project, country, lines, taxLines, docs |
| PATCH | `/api/quotes/[id]` | Update status, notes, etc. |
| DELETE | `/api/quotes/[id]` | Archiva (status=ARCHIVED) |
| GET | `/api/quotes/[id]/pdf` | Genera PDF con @react-pdf y lo sirve como stream |
| POST | `/api/quotes/[id]/email` | `{ to, message? }` — envía con Resend |

**Body de POST `/api/quotes`:**
```typescript
{
  projectId: string
  costMethod: "CSV" | "M2_BY_SYSTEM" | "M2_TOTAL"
  baseUom: "M" | "FT"
  revitImportId?: string       // solo para CSV
  warehouseId?: string
  reserveStock: boolean
  m2S80: number
  m2S150: number
  m2S200: number
  m2Total: number
  commissionPct: number
  commissionFixed: number
  commissionFixedPerKit: number
  freightCostUsd: number
  freightProfileId?: string
  numContainers: number
  kitsPerContainer: number
  totalKits: number
  countryId?: string
  taxRuleSetId?: string
  notes?: string
}
```

### Sales
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/api/sales` | List sales; query: page, limit, status, clientId, projectId, from, to, search |
| POST | `/api/sales` | Create sale (clientId, projectId, quoteId?, quantity, financials, invoices[], status) |
| GET | `/api/sales/[id]` | Sale detail with invoices and payments |
| PATCH | `/api/sales/[id]` | Update sale and/or invoices |
| POST | `/api/sales/[id]/payments` | Record payment (entityId, amountUsd, amountLocal?, exchangeRate?, paidAt?, notes?) |
| GET | `/api/sales/entities` | List billing entities for org (todos los usuarios autenticados) |
| POST | `/api/sales/entities` | Create entity (SUPERADMIN only) |
| GET/PATCH/DELETE | `/api/sales/entities/[id]` | Single entity; PATCH/DELETE SUPERADMIN only |
| GET | `/api/sales/statements` | Account statements; query: clientId, entityId, from, to |
| GET | `/api/sales/statements/export` | Export CSV; same query params |
| GET | `/api/sales/reports/summary` | KPIs: totalSales, totalValue, totalPaid, totalPending, byStatus, entitySummary |
| GET | `/api/sales/notifications/due` | SaleInvoices due in next N days (default 7); query: days=7 |

### Catálogo
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/api/catalog` | `?systemCode=&search=&page=&pageSize=` — incluye costs y aliases |
| POST | `/api/catalog` | Crear pieza con costo inicial |
| PATCH | `/api/catalog/[id]` | Actualizar pieza; crea nuevo PieceCost si cambia precio |
| DELETE | `/api/catalog/[id]` | Soft delete (isActive=false) |
| POST | `/api/catalog/import` | Bulk import desde Excel (multipart form) |

### CSV Import
| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/api/import/csv` | `multipart/form-data` con archivo CSV + `projectId?` |
| GET | `/api/import/[id]` | Devuelve import con lines y piece metadata |
| POST | `/api/import/[id]/map` | Finaliza mapeo manual de piezas unmatched |

### Admin
| Método | Ruta | Notas |
|--------|------|-------|
| GET/PATCH | `/api/admin/settings` | Org settings (rates, minRunFt, etc.) |
| GET/POST | `/api/admin/users` | Listar y crear usuarios |
| PATCH/DELETE | `/api/admin/users/[id]` | Aprobar/rechazar/suspender |
| GET/POST | `/api/admin/warehouses` | CRUD warehouses |
| PATCH/DELETE | `/api/admin/warehouses/[id]` | — |

### Geografía / Flete / Impuestos
| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/countries` | Países configurados para la org |
| PATCH/DELETE | `/api/countries/[id]` | — |
| GET/POST | `/api/freight` | `?countryId=` — perfiles de flete |
| PATCH/DELETE | `/api/freight/[id]` | — |
| GET/POST | `/api/tax-rules` | `?countryId=` — conjuntos de reglas de impuestos |
| PATCH/DELETE | `/api/tax-rules/[id]` | — |

### Inventario
| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/inventory` | `?warehouseId=&pieceId=` |
| POST | `/api/inventory/[id]/move` | `{ type, qty, toWarehouseId?, notes? }` |

---

## 7. Frontend — Páginas y Componentes

### Páginas del Dashboard (App Router)

```
/(dashboard)/dashboard          # KPIs generales
/(dashboard)/projects           # Lista de proyectos
/(dashboard)/projects/new       # Crear proyecto
/(dashboard)/projects/[id]      # Detalle de proyecto con imports y cotizaciones
/(dashboard)/quotes             # Lista de cotizaciones
/(dashboard)/quotes/new         # Wizard de 6 pasos
/(dashboard)/quotes/[id]        # Detalle de cotización con breakdown financiero
/(dashboard)/sales              # Lista de ventas (tabla ancha: EXW, FOB, CIF, DDP, etc.)
/(dashboard)/sales/new          # Nueva venta (cliente, proyecto, quote opcional, financials)
/(dashboard)/sales/[id]         # Detalle venta, invoices, pagos, agregar pago
/(dashboard)/sales/statements   # Estados de cuenta por cliente/entidad, export CSV
/(dashboard)/admin/catalog      # Catálogo de piezas con filtros y edición
/(dashboard)/admin/entities     # Billing entities: listar, crear, editar (SUPERADMIN only)
/(dashboard)/admin/countries    # Gestión de países
/(dashboard)/admin/freight      # Perfiles de flete por país
/(dashboard)/admin/inventory    # Inventario por warehouse
/(dashboard)/admin/settings     # Settings de la org (tasas, UOM, etc.)
/(dashboard)/admin/taxes        # Tax Rule Sets por país
/(dashboard)/admin/users        # Gestión de usuarios
/(dashboard)/admin/warehouses   # Gestión de warehouses
```

### Rol y permisos
- `VIEWER` — solo lectura
- `SALES` — crear/editar proyectos y cotizaciones
- `ADMIN` — todo + gestión de catálogo, impuestos, flete
- `SUPERADMIN` — todo + gestión de usuarios, org y **Billing Entities** (Admin → Entities)

---

## 8. Quote Wizard — Flujo Detallado

El wizard está en `/quotes/new/page.tsx`. El estado compartido es `QuoteWizardState`.

```typescript
interface QuoteWizardState {
  // Step 1
  projectId: string
  costMethod: "CSV" | "M2_BY_SYSTEM"
  baseUom: "M" | "FT"
  warehouseId?: string
  reserveStock: boolean
  // Step 2 (CSV)
  revitImportId?: string
  importRows?: any[]
  // Step 3 (Material)
  m2S80: number; m2S150: number; m2S200: number; m2Total: number
  csvLines?: any[]
  // Step 4 (Commission)
  commissionPct: number
  commissionFixed: number        // total por orden (fuente de verdad)
  commissionFixedPerKit: number  // alias UI = commissionFixed / totalKits
  kitsPerContainer: number
  totalKits: number
  numContainers: number          // auto-calculado desde m² o kits
  // Step 5 (Destination)
  countryId?: string
  freightProfileId?: string
  freightCostUsd: number
  taxRuleSetId?: string
  notes?: string
  // Computed (sincronizados por useEffect en cada step)
  factoryCostUsd?: number
  fobUsd?: number
  cifUsd?: number
  taxesFeesUsd?: number
  landedDdpUsd?: number
}
```

### Step 1 — Método de costeo
Selección de proyecto y método: `CSV` (importar desde Revit) o `M2_BY_SYSTEM` (entrada manual de m²). Si no es CSV, el Step 2 se salta.

### Step 2 — CSV Import (`step2-csv.tsx`)
- Upload de archivo CSV → POST `/api/import/csv`
- Muestra resultado del matching: matched vs unmatched
- Items unmatched se pueden mapear manualmente o ignorar
- Al avanzar: `revitImportId` queda en el estado

### Step 3 — Material Cost (`step3-material.tsx`)
**CSV mode:**
- Carga `/api/import/[id]` → extrae m2S80/150/200 sumando `m2Line` por `piece.systemCode`
- Si las piezas tienen `pricePerM` → `factoryCostUsd = Σ(linearM × pricePerM)`
- Si no hay precios → fallback a m² × tasas del org (banner ámbar de advertencia)

**M2_BY_SYSTEM mode:**
- Inputs manuales de m² por sistema
- `factoryCostUsd = m2S80×rateS80 + m2S150×rateS150 + m2S200×rateS200`
- Se sincroniza en tiempo real con `useEffect`

### Step 4 — Logistics & Commission (`step4-commission.tsx`)
**Container Logistics:**
- `numContainers` se auto-calcula desde m² al montar el step:
  - S80: 650 m²/contenedor 40ft HC
  - S150: 420 m²/contenedor
  - S200: 300 m²/contenedor
  - Muestra: `≈2.61 → 3 · uses 87% of capacity`
- Si `totalKits` y `kitsPerContainer` están configurados, el cálculo de kits tiene prioridad

**Commission:**
- `commissionFixed` (per order) y `commissionFixedPerKit` están **vinculados**:
  - Editar "per order" → `perKit = fixed / totalKits`
  - Editar "per kit" → `fixed = perKit × totalKits`
- `FOB = factoryCost + (factoryCost × commissionPct/100) + commissionFixed`

### Step 5 — Destination (`step5-destination.tsx`)
- Selección de país → carga perfiles de flete y conjuntos de impuestos
- Auto-selecciona perfil de flete default y primer tax rule set activo
- Cálculo en tiempo real de CIF, impuestos y DDP
- `useEffect` sincroniza `{ fobUsd, cifUsd, taxesFeesUsd, landedDdpUsd }` al estado del wizard

### Step 6 — Preview (`step6-preview.tsx`)
- Muestra resumen financiero completo leyendo del `QuoteWizardState`
- `landedDdpUsd` (seteado por step 5) se muestra en el banner azul
- Al confirmar → POST `/api/quotes` → servidor re-corre `buildQuoteSnapshot` con los datos del wizard

---

## 9. Flujo de Importación CSV

```
1. Usuario sube CSV (POST /api/import/csv)
   ↓
2. Servidor llama parseRevitCsv(csvText):
   - Detecta fila de headers reales (pueden estar en fila 0 o 1)
   - Filtra subtotales, grand totals y filas vacías
   - Parsea qty y heightMm
   - Normaliza rawPieceName con normalizeAliasRaw()
   ↓
3. Para cada fila → matchPiece(row, catalog, codeIndex):
   - EXACT_CODE: rawPieceCode.toLowerCase() en índice de aliases
   - ALIAS: normalizedName == alias.aliasNormalized
   - CANONICAL: normalizedName == piece.canonicalNameNormalized
   - UNMATCHED: no match
   ↓
4. Para líneas matched:
   - computeLineMetrics() → linearM, m2Line, weights, volume
   - Precio actual de PieceCost → pricePerM, lineTotal
   ↓
5. Guarda RevitImport + RevitImportLine en DB
   ↓
6. Responde con { importId, rowCount, matchedCount, unmappedCount, lines[] }
   ↓
7. En Step 2 del wizard: usuario puede mapear manualmente las UNMATCHED
   POST /api/import/[id]/map → actualiza pieceId + recalcula métricas
```

---

## 10. Convenciones y Patrones

### Naming
- **IDs:** CUID (`@default(cuid())`)
- **Tablas:** `snake_case` plural (ej: `piece_catalog`, `org_members`)
- **Modelos Prisma:** PascalCase singular (ej: `PieceCatalog`)
- **Campos:** camelCase

### Auth y autorización
- Todo bajo `(dashboard)/` requiere sesión activa (verificada en `layout.tsx`)
- El `session.user` tiene: `id`, `email`, `role`, `orgId`, `orgSlug`
- Los API handlers hacen `getServerSession(authOptions)` y verifican `user.role` para operaciones sensibles
- `VIEWER` solo puede hacer GET

### Multi-tenancy
- Todos los datos están aislados por `orgId`
- Cada query incluye `where: { orgId: user.orgId }`

### Audit trail
- `createAuditLog()` se llama en los handlers después de operaciones importantes
- Registra: `orgId`, `userId`, `action` (del enum `AuditAction`), `entityType`, `entityId`, `meta`

### Patrones React
- Componentes del wizard son "client components" (`"use client"`)
- El estado del wizard vive en el page y se pasa como props `{ state, update }`
- `update` es un `useCallback` estable con `setState(prev => ({ ...prev, ...patch }))`
- Los cálculos derivados se sincronizan a state con `useEffect` (no se computan en el render del server)

### CSS / Tailwind
- Tailwind con JIT
- Colores de marca: `text-vbt-blue`, `bg-vbt-blue`, `text-vbt-orange`, `bg-vbt-orange`
- Componentes UI de shadcn (en `components/ui/`) — NO modificar directamente
- Clases responsivas: `md:grid-cols-3`, etc. — mobile-first

---

## 11. Variables de Entorno

```bash
# Base de datos (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# Email (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM="noreply@vbt.com"

# (Opcional) Storage para PDFs
BLOB_READ_WRITE_TOKEN="..."
```

---

## 12. Comandos de Desarrollo

```bash
# Instalar dependencias (desde raíz)
pnpm install

# Desarrollo
pnpm dev              # Inicia todos los workspaces (turbo)
pnpm --filter web dev # Solo la app web

# Base de datos
pnpm --filter @vbt/db db:generate   # Genera Prisma client
pnpm --filter @vbt/db db:push       # Push schema a DB
pnpm --filter @vbt/db db:studio     # Abre Prisma Studio
pnpm --filter @vbt/db db:seed       # Ejecuta seed.ts

# Tests
pnpm --filter @vbt/core test        # Tests de la librería core (Vitest)

# Build
pnpm build
```

---

## 13. Lógica de Precios — Resumen

```
pricePer5000ftCored  →  pricePerFtCored = / 5000
                     →  pricePerMCored  = pricePerFt / FT_TO_M

lineTotal (UOM=M) = linearM × pricePerMCored
lineTotal (UOM=FT)= linearFt × pricePerFtCored

lineTotalWithMarkup = lineTotal × (1 + markupPct/100)

factoryCostUsd (CSV)          = Σ lineTotalWithMarkup
factoryCostUsd (M2_BY_SYSTEM) = m2S80×37 + m2S150×67 + m2S200×85
factoryCostUsd (M2_TOTAL)     = m2Total × rateGlobal

commissionAmount = factoryCostUsd × commissionPct/100 + commissionFixed
fobUsd           = factoryCostUsd + commissionAmount
cifUsd           = fobUsd + freightCostUsd
taxesFeesUsd     = Σ tax rules aplicadas sobre CIF/FOB
landedDdpUsd     = cifUsd + taxesFeesUsd   ← PRECIO FINAL
```

---

## 14. Capacidades de Contenedores (40ft HC)

| Sistema | m² de muro / contenedor |
|---------|------------------------|
| VBT 80mm (S80) | 650 m² |
| VBT 150mm (S150) | 420 m² |
| VBT 200mm (S200) | 300 m² |

El wizard auto-calcula `numContainers = ⌈m2S80/650 + m2S150/420 + m2S200/300⌉` y muestra el % de ocupación.

---

## 15. Sistemas de Paneles VBT

| Código | Nombre | Espesor | USD/m² default | Hormigón (m³/m²) | Acero (kg/m²) |
|--------|--------|---------|---------------|-------------------|----------------|
| S80 | VBT 80mm | 80mm | $37 | 0.08 | 4 |
| S150 | VBT 150mm | 150mm | $67 | 0.15 | 6 |
| S200 | VBT 200mm | 200mm | $85 | 0.20 | 8 |

---

*Última actualización: Marzo 2026*

# Entidades de facturación (B2B2B): fabricante vs distribuidores

## Modelo de negocio

- **Vision Latam / VBT (superadmin)** actúa como **productor del sistema constructivo** (marca, ingeniería, suministro centralizado o mixto).
- **Partners** son **distribuidores** con su propia relación comercial con el cliente final, su territorio y, a menudo, su propia razón social para facturar o cobrar.

## Cómo se usa en la industria (resumen)

No hay un único estándar legal global; lo habitual en canales B2B2B es:

1. **Factura del fabricante al distribuidor** (mayorista / transfer pricing): el end customer recibe una cadena de facturas o una sola según incoterm y país.
2. **Factura del distribuidor al cliente final**: el fabricante factura solo al partner (comisión o margen incorporado).
3. **Varias razones sociales del mismo grupo** (holding): distintas entidades legales por país o por tipo de operación (ej. importación vs servicio local).

En software ERP/CRM de canales, las “**billing entities**” o “**company codes**” suelen ser:

- Razones sociales **reales** que emiten factura fiscal.
- Configuradas **por organización del partner** (cada distribuidor sus propias sociedades) o, en modelos muy centralizados, solo entidades del fabricante.

## Qué hace hoy la plataforma

- Cada **`BillingEntity`** está ligada a **`organizationId`** (la organización del **partner** en el modelo SaaS).
- `ensureBillingEntities` crea un set **por defecto** por org (Vision Profile, Vision Latam, VBT Argentina, etc.) para que ventas/pagos tengan a qué asignar montos.
- **Superadmin** gestiona entidades eligiendo **partner** explícito (lista / alta / edición).
- **Partner `org_admin`** puede crear/editar entidades de **su** org vía API (misma lógica de permisos); el rol **`sales_user`** usa las entidades en ventas pero no las administra.

## Recomendación de producto

| Escenario | Sugerencia |
|-----------|------------|
| El partner factura al cliente con su propia razón | Mantener entidades **por `organizationId` del partner**; nombres/slugs alineados a sus sociedades reales. |
| Solo Vision Latam factura al end customer | Seed + entidades del partner pueden reflejar **solo** las sociedades del fabricante que operan en ese mercado; el partner sigue siendo el “tenant” operativo (proyectos, cotizaciones). |
| Mixto (parte fabricante, parte partner) | Varias líneas de factura/pago en la venta, cada una contra una **entidad** distinta (ya soportado por entidad en facturas y pagos). |

## Evolución posible (sin implementar ahora)

- Campo **`issuerType`**: `manufacturer` | `partner` | `shared` para reporting.
- **Plantillas por país** de entidades legales al dar de alta un partner.
- Integración contable (ERP) exportando por `slug` de entidad.

Este documento es orientativo; las decisiones fiscales deben validarse con contaduría y abogados locales.

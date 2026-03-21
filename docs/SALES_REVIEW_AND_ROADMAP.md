# Sales module – Revisión y roadmap

## Ejecución del seed

- **Requisito previo:** El cliente Prisma debe incluir los modelos de Sales (`BillingEntity`, `Sale`, etc.). Si acabas de aplicar el schema, ejecuta antes:
  ```bash
  pnpm --filter @vbt/db exec prisma generate
  ```
  (Cierra el dev server si da EPERM al generar.)
- **Comando:** Desde la raíz: `pnpm run db:seed` o `pnpm --filter @vbt/db seed`.
- Se añadió `prisma.seed` en `packages/db/package.json` para que `npx prisma db seed` (desde `packages/db`) también funcione.
- El seed crea, para cada org existente, cuatro `BillingEntity`: **Vision Profile Extrusions LTD**, **Vision Latam SA**, **VBT Argentina SA**, **VBT Panama SA** (slugs: VISION_PROFILE_EXTRUSIONS, VISION_LATAM, VBT_ARGENTINA, VBT_PANAMA). Es idempotente (upsert por `orgId` + `slug`).
- Las entidades también se pueden gestionar en la app: **Admin → Entities** (solo SUPERADMIN). Ahí se listan, crean y editan (nombre, slug, activo/inactivo).
- Si el seed falla con `Cannot read properties of undefined (reading 'upsert')`, es que el client no tiene aún `billingEntity`: ejecuta `prisma generate` y vuelve a lanzar el seed.

---

## Bugs corregidos en esta revisión

1. **Número de venta (race condition)**  
   `saleNumber` se generaba antes de la transacción, por lo que dos requests simultáneos podían obtener el mismo número. **Corregido:** la generación se hace dentro de `prisma.$transaction` usando `getNextSaleNumber(tx, orgId)`.

---

## Revisión del flujo – sin bugs críticos detectados

- **POST /api/sales:** Validación quote/project/client, generación de `saleNumber` en transacción, creación de Sale + SaleInvoices, y al confirmar se actualiza proyecto a SOLD.
- **Pagos:** No se permiten en ventas CANCELLED; al registrar un pago se recalcula el status de la venta (PARTIALLY_PAID / PAID).
- **Estados de cuenta:** Agrupación por cliente (y opcionalmente por entidad), totales invoiced/paid/balance coherentes.
- **Notificaciones de vencimiento:** Cuotas con `dueDate` en los próximos N días para ventas no canceladas ni totalmente pagadas; el front puede filtrar por `pendingForEntity` si quiere mostrar solo pendientes.

---

## Implementado recientemente (schema partner + API)

- **Modelo Prisma:** `BillingEntity`, `Sale`, `SaleInvoice`, `Payment` (multi-tenant por `organization_id`), migración `20260320140000_partner_sales_billing`.
- **API `/api/sales`:** listado, creación, detalle `GET/PATCH/DELETE`, pagos `POST` + `DELETE /api/sales/payments/[id]`, facturas `POST/PATCH/DELETE`.
- **Entidades de facturación:** `GET /api/sales/entities` hace upsert de las cuatro entidades por defecto por org (Vision Profile Extrusions, Vision Latam, VBT Argentina, VBT Panama).
- **Estados de cuenta:** `GET /api/sales/statements`, export CSV/PDF `GET /api/sales/statements/export?format=csv|pdf`, email con PDF `POST /api/sales/statements/email`.
- **Recordatorios:** `GET /api/sales/notifications/due?days=7` (conteo para UI); cron diario `GET /api/cron/sales-due-reminders` (Vercel: header `x-vercel-cron` o `Authorization: Bearer CRON_SECRET`) envía digest a org_admins vía Resend.
- **Dashboard:** KPI ventas YTD = suma `landedDdpUsd` de ventas no canceladas del año (no cotizaciones).

## Pendiente del plan (opcional / siguiente iteración)

| Item | Estado | Notas |
|------|--------|--------|
| Asignación FIFO de pagos a cuotas | No implementado | Plan §11: status por cuota (PENDING/PARTIAL/PAID por fila). Hoy el status se calcula a nivel venta/entidad. |
| Edición de venta (UI) | Parcial | Existe `/sales/[id]/edit` y PATCH; reglas: no reemplazar líneas de factura si ya hay pagos. |

---

## Mejoras recomendadas para esta plataforma

### Ventas y cobranza

- **Recordatorios automáticos:** Cron o Vercel Cron que, por ejemplo cada día, consulte vencimientos en 3/7 días y envíe email al cliente o al usuario interno (con link a la venta o al estado de cuenta).
- **Editar venta desde detalle:** Botón “Edit” que abra un formulario (o redirija a `/sales/[id]/edit`) con los mismos campos que “New sale” + cuotas por entidad, usando PATCH.
- **Eliminar / anular pago:** Endpoint `DELETE /api/sales/payments/[id]` (o PATCH con status “reversed”) y en UI botón “Revert” con confirmación; recalcular status de la venta tras el cambio.
- **Estado de cuenta por entidad (vista dedicada):** Filtro “solo entidad X” en Statements está; se podría añadir una vista “Por empresa” que agrupe por BillingEntity y muestre total facturado/cobrado/pendiente por entidad a nivel global (no solo por cliente).

### Proyectos y cotizaciones

- **Vincular venta desde proyecto:** En detalle de proyecto, lista “Ventas” (sales con ese projectId) con link a cada venta y total DDP.
- **Desde quote → “Convertir en venta”:** En detalle de cotización, botón “Create sale from this quote” que prellene `/sales/new` con projectId, clientId, quoteId y quantity=1.

### Reportes

- **Gráficos de ventas:** En Reports > Sales, añadir gráfico por mes (valor DDP, cantidad de ventas) y por cliente (top por monto).
- **Export de reporte Sales:** Botón “Export CSV” en la sección Sales de Reports que descargue el mismo dataset que el resumen (o un listado de ventas con filtros).

### Operación y datos

- **Tipos de cambio por defecto:** Si la mayoría de pagos en un país usan la misma moneda y tipo de cambio, poder fijar “moneda local” y “tipo de cambio por defecto” por país o por entidad para prellenar el formulario de pago.
- **Duplicar venta:** Botón “Duplicate” que cree una nueva venta en DRAFT con los mismos client/project/quote/quantity y valores financieros (y sin pagos ni cuotas), para reutilizar una venta como plantilla.

### UX y consistencia

- **Permisos por rol:** VIEWER solo lectura; SALES/ADMIN crean y editan ventas y pagan; **SUPERADMIN** además gestiona Billing Entities en Admin → Entities (crear, editar nombre/slug/activo, eliminar si no en uso).
- **Validación en cliente:** En “New sale”, validar que DDP ≥ CIF ≥ FOB ≥ EXW y que los importes no sean negativos antes de enviar.
- **Traducciones:** Revisar que todas las cadenas nuevas de Sales (labels, botones, mensajes) tengan clave en i18n y valor en español donde corresponda.

---

## Resumen

- Seed: ejecutar con `pnpm run db:seed` (o `pnpm --filter @vbt/db seed`); las BillingEntities se crean para todas las orgs.
- Bug de concurrencia en `saleNumber` corregido.
- Flujo actual revisado y consistente; lo que queda pendiente es opcional o de siguiente iteración (edición UI, PDF/email, FIFO por cuota, PATCH/DELETE pago).
- El documento anterior recoge mejoras sugeridas para ventas, reportes, proyectos/quotes y operación, para priorizar en futuras versiones.

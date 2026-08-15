# Manual de procedimientos para partners

Este documento describe paso a paso cómo realizar las tareas habituales en el **panel de partners** de la plataforma (Vision Latam). Sirve como guía para usuarios y como base para verificar que las funcionalidades coincidan con lo documentado.

---

## 1. Introducción

### 1.1 Acceso al panel

1. Ingresá a la URL de la aplicación (ej. `https://app.visionlatam.com`).
2. Iniciá sesión con tu correo y contraseña (o el link de invitación si es la primera vez).
3. Tras el login, serás redirigido al **Dashboard** (`/dashboard`).

### 1.2 Navegación principal

El menú lateral está agrupado alrededor del viaje comercial. El CTA **Nueva cotización** (arriba del menú) abre el asistente en `/quotes/wizard`.

| Grupo | Sección | Ruta | Descripción |
|--------|---------|------|-------------|
| — | Dashboard | `/dashboard` | Resumen de proyectos, cotizaciones y metas. |
| Comercial | Cotizaciones | `/quotes` | Lista de cotizaciones. |
| Comercial | Ventas | `/sales` | Ventas, facturas y estados de cuenta *(org_admin / sales_user)*. |
| Comercial | Estados de cuenta | `/sales/statements` | Estados de cuenta por cliente. |
| Comercial | Reportes | `/reports` | Reportes del partner *(org_admin / sales_user)*. |
| Cartera | Clientes | `/clients` | Lista y gestión de clientes. |
| Cartera | Proyectos | `/projects` | Lista y gestión de proyectos. |
| Cartera | Diseño | `/engineering` | Solicitudes de diseño / ingeniería. |
| Operación | Inventario | `/inventory` | Stock del partner. |
| Recursos | Documentos | `/documents` | Biblioteca de documentos. |
| Recursos | Capacitación | `/training` | Programas de capacitación. |
| Configuración | Resumen, equipo, bodegas, flete, impuestos, actividad | `/settings` y subrutas | Solo `org_admin`. El perfil está en el footer, no en este grupo. |

**Nota:** Ventas y Reportes no aparecen para viewer ni técnico. Si no los ves, consultá con el administrador de la organización.

---

## 2. Clientes

### 2.1 Registrar un cliente desde la lista de clientes

1. Ir a **Clientes** (`/clients`).
2. Clic en el botón **Nuevo cliente** (o similar).
3. Completar el formulario:
   - **Nombre** (obligatorio): nombre o razón social.
   - Razón social, CUIT/NIF, dirección, ciudad, país, teléfono, email, web, notas (opcionales).
4. Clic en **Guardar** (o **Crear**).
5. El cliente aparecerá en la lista y podés hacer clic en él para ver detalle y proyectos vinculados.

### 2.2 Registrar un cliente al crear o editar un proyecto

1. En **Proyectos** → **Nuevo proyecto** (`/projects/new`) o en el detalle de un proyecto al **Editar**.
2. En el campo **Cliente**, si el cliente no existe, usar la opción **Crear nuevo cliente** (o modal “Nuevo cliente”).
3. Completar nombre y datos del cliente en el modal.
4. Guardar el cliente; luego seleccionarlo como cliente del proyecto y guardar el proyecto.

### 2.3 Editar un cliente y ver detalle

1. Ir a **Clientes** (`/clients`).
2. Buscar el cliente por nombre (barra de búsqueda) o en la lista.
3. Clic en el cliente para abrir su **detalle** (`/clients/[id]`).
4. En el detalle podés ver proyectos vinculados y, si está disponible, **Editar** para cambiar datos (nombre, contacto, país, etc.).

---

## 3. Proyectos

### 3.1 Crear un nuevo proyecto

1. Ir a **Proyectos** (`/projects`).
2. Clic en **Nuevo proyecto** (enlace a `/projects/new`).
3. Completar:
   - **Nombre del proyecto** (obligatorio).
   - **Cliente**: seleccionar uno existente o crear uno nuevo (opcional).
   - País, ciudad, dirección, descripción (opcionales).
4. Clic en **Crear proyecto**.
5. Serás redirigido al detalle del proyecto (`/projects/[id]`).

### 3.2 Ver lista y detalle de proyectos

1. **Lista:** en **Proyectos** (`/projects`) se muestra la lista con búsqueda y filtros (por estado, cliente, etc.).
2. **Detalle:** clic en un proyecto para abrir `/projects/[id]` (datos del proyecto, cotizaciones asociadas, ventas si aplica).

### 3.3 Cambiar estado de un proyecto

1. Abrir el **detalle del proyecto** (`/projects/[id]`).
2. Clic en **Editar** (o botón equivalente).
3. En el formulario de edición, cambiar el campo **Estado** (Status). Valores típicos:
   - Lead  
   - Qualified  
   - Quoting  
   - Engineering  
   - Won  
   - Lost  
   - On hold  
4. Guardar los cambios.

---

## 4. Cotizaciones

El camino canónico para cotizar es el **asistente de 5 pasos** en `/quotes/wizard`. Las rutas viejas `/quotes/new` y `/quotes/create` redirigen ahí.

Unidad comercial: **m² → kit** (unidades iguales del mismo despiece) **→ contenedor**. Los sistemas se muestran como **VBT 80 / 150 / 200 mm** (códigos internos S80 / S150 / S200).

### 4.1 Abrir el asistente

1. Clic en **Nueva cotización** en el sidebar, o en el Dashboard, o en **Cotizaciones**.
2. Se abre `/quotes/wizard`. Si venís de un proyecto, el `projectId` puede venir en la URL.

### 4.2 Pasos del wizard

#### Paso 1: Proyecto y método

1. Seleccionar el **proyecto**.
2. Elegir el **método de costo**:
   - **CSV (desde Revit):** importar un CSV con partidas/líneas.
   - **m² por sistema:** cargar metros cuadrados por VBT 80 / 150 / 200 cuando no hay CSV.
3. Si hay un diseño entregado para ese proyecto, se puede vincular. Si no, hay un enlace a **Nueva solicitud de diseño**.
4. Clic en **Siguiente**.

#### Paso 2: Importación CSV *(solo si elegiste CSV)*

1. Subir o pegar el CSV, revisar el mapeo de columnas y asignar piezas del catálogo.
2. Ajustar cantidades/áreas si hace falta.
3. Clic en **Siguiente**. Con el método m² este paso se omite.

#### Paso 3: Material y precio

1. Revisar material, peso, volumen y el **precio base VL** (el partner no ve EXW de fábrica).
2. Cargar el **precio al cliente** / markup del partner.
3. Clic en **Siguiente**.

#### Paso 4: Destino y flete

1. País de destino (solo países del territorio del partner).
2. Perfil de flete y contenedores. El landed se calcula **después del flete**.
3. Clic en **Siguiente**.

#### Paso 5: Vista previa y crear

1. Revisar totales, flete, impuestos del país y precio landed.
2. Clic en **Crear cotización**. Queda en borrador y se abre `/quotes/[id]`.

### 4.3 Cambiar estado de una cotización

1. Ir a **Cotizaciones** (`/quotes`) y abrir la cotización deseada (`/quotes/[id]`).
2. En el detalle, abrir el diálogo o sección **Editar** (por ejemplo para estado y notas).
3. En el campo **Estado**, elegir el valor correspondiente. En la interfaz pueden aparecer opciones como:
   - Borrador (draft)  
   - Enviada (sent)  
   - Aceptada (accepted)  
   - Rechazada (rejected)  
   - Expirada (expired)  
   *(Algunas pantallas pueden mostrar etiquetas distintas; los valores que acepta el sistema son los anteriores.)*
4. Guardar los cambios.

### 4.4 Exportar cotización a PDF

1. Abrir el **detalle de la cotización** (`/quotes/[id]`).
2. Clic en el botón **PDF** (o “Descargar PDF”). Se abre un diálogo de opciones.
3. Marcar o desmarcar según corresponda:
   - **Incluir alertas** (mínimos de corrida, etc.).
   - **Incluir líneas de material** en el PDF.
   - **Mostrar precio unitario** en las líneas.
4. Clic en **Descargar PDF**. Se abrirá o descargará el archivo generado (`GET /api/quotes/[id]/pdf` con los parámetros elegidos).

### 4.5 Enviar cotización por email

1. En el detalle de la cotización (`/quotes/[id]`), usar el botón **Enviar por email** (o “Send email”).
2. Completar los datos que pida el formulario (destinatario, mensaje si aplica).
3. Confirmar el envío. La plataforma enviará el email con el enlace o adjunto correspondiente.

### 4.6 Crear venta desde una cotización

1. En el detalle de una cotización **aceptada**, usar el botón **Crear venta** (o “Create sale”).
2. Serás redirigido a **Nueva venta** (`/sales/new`) con la cotización y el proyecto ya vinculados. Seguir el procedimiento de la sección **5. Ventas y facturación**.

---

## 5. Ventas y facturación

**Nota:** El menú **Ventas** puede estar visible solo para ciertos roles. Si no lo ves, consultá con el administrador.

### 5.1 Crear una venta desde una cotización

1. Desde el detalle de una cotización aceptada, clic en **Crear venta** (ver 4.6), o ir a **Ventas** (`/sales`) y clic en **Nueva venta**.
2. Si venís desde la cotización, el sistema precargará cotización, proyecto y cliente.
3. Completar:
   - Condición de venta (Incoterm) para el monto facturable: **EXW**, **FOB**, **CIF** o **DDP**.
   - El monto facturable se calcula según la condición elegida (sobre los valores de la cotización).
4. Guardar la venta. Quedarás en el detalle de la venta (`/sales/[id]`).

### 5.2 Registrar líneas de factura

1. Abrir el **detalle de la venta** (`/sales/[id]`).
2. En la sección **Invoices** (Facturas), clic en **Add line** (Agregar línea).
3. En el modal de línea de factura, completar:
   - **Entidad** (entity): entidad de facturación a la que se asocia esta factura.
   - **Monto (USD):** monto de la factura. La suma de todas las líneas no puede superar el monto facturable de la venta para la condición elegida (EXW/FOB/CIF/DDP).
   - **Fecha de vencimiento** (due date).
   - **Número de factura** (referencia externa), opcional.
   - Notas, si aplica.
4. Guardar la línea. Podés agregar varias líneas hasta cubrir el monto facturable.
5. Para **editar** o **eliminar** una línea, usar los controles en cada fila de la sección Invoices.

### 5.3 Registrar pagos

Si la aplicación tiene la opción de registrar pagos sobre facturas o sobre la venta, debería estar en el detalle de la venta (`/sales/[id]`) o en una subsección de pagos. Completar monto, fecha y referencia según los campos disponibles.

### 5.4 Ver estados de cuenta

1. Ir a **Ventas** → **Estados de cuenta** (o **Account statements**) (`/sales/statements`).
2. Ajustar los **filtros** (fechas desde/hasta, cliente, entidad, etc.) si están disponibles.
3. Revisar el listado de statements (resumen por cliente/entidad, facturado, cobrado, saldo).
4. Opciones típicas:
   - **Exportar:** descargar el reporte (PDF o Excel según lo ofrezca la app).
   - **Enviar por email:** enviar el estado de cuenta por correo a uno o más destinatarios.

---

## 6. Otros módulos

- **Ingeniería** (`/engineering`): listado y creación de solicitudes de ingeniería; desde cada solicitud podés ver estado, archivos y entregables.
- **Documentos** (`/documents`): consulta de la biblioteca de documentos disponibles para partners.
- **Capacitación** (`/training`): programas y módulos de capacitación; seguimiento de progreso si aplica.
- **Configuración** (`/settings`): ajustes generales del partner. **Equipo** (`/settings/team`): gestión de usuarios del equipo (según permisos del rol).

---

## 7. Checklist de verificación

Usá esta lista para comprobar que cada flujo funciona correctamente en tu entorno. Marcar cada ítem al validarlo.

### Clientes

- [ ] Desde `/clients`, crear un cliente nuevo y verlo en la lista.
- [ ] Desde `/clients`, editar un cliente existente y ver los cambios en el detalle.
- [ ] Desde `/projects/new`, crear un cliente desde el modal y asignarlo al proyecto.
- [ ] En el detalle de un cliente, ver los proyectos vinculados.

### Proyectos

- [ ] Desde `/projects/new`, crear un proyecto con nombre y cliente y verlo en la lista.
- [ ] En el detalle de un proyecto (`/projects/[id]`), editar y cambiar el estado (p. ej. Lead → Quoting).
- [ ] Ver en el detalle del proyecto las cotizaciones asociadas.

### Cotizaciones

- [ ] Desde el CTA **Nueva cotización**, abrir `/quotes/wizard`.
- [ ] Completar el wizard con método **CSV**: subir/pegar CSV, completar los pasos y crear la cotización.
- [ ] Completar el wizard con método **m² por sistema**: cargar m² VBT 80/150/200, completar los pasos y crear la cotización.
- [ ] En el paso de precio, setear el markup / precio al cliente y ver que se refleje en la vista previa.
- [ ] En el detalle de una cotización, cambiar el estado (p. ej. Borrador → Enviada) y guardar.
- [ ] En el detalle de una cotización, abrir el diálogo PDF, elegir opciones y descargar el PDF.
- [ ] En el detalle de una cotización, enviar por email (si está disponible).
- [ ] Desde una cotización aceptada, usar “Crear venta” y llegar a `/sales/new` con datos precargados.

### Ventas y facturación

- [ ] Crear una venta desde una cotización (o desde `/sales/new`) y verla en `/sales/[id]`.
- [ ] En el detalle de la venta, agregar una línea de factura (entidad, monto, vencimiento) y guardar.
- [ ] Comprobar que la suma de montos de facturas no supere el monto facturable de la venta.
- [ ] Ir a `/sales/statements`, aplicar filtros y ver el listado de estados de cuenta.
- [ ] Exportar o enviar por email el estado de cuenta (si está disponible).

### Navegación y permisos

- [ ] Confirmar que el menú lateral muestra las opciones esperadas según tu rol (Dashboard, Proyectos, Clientes, Cotizaciones, Ventas si aplica, etc.).
- [ ] Si tenés rol con acceso a Ventas, confirmar que podés acceder a `/sales` y `/sales/statements`.

---

## 8. Ajustes detectados / pendientes de alinear

Al redactar o probar con la aplicación actual, se pueden anotar aquí incoherencias para corregir en código o configuración:

- **Estados de cotización en la UI:** En algunas pantallas el selector de estado muestra “DRAFT”, “SENT”, “ARCHIVED”, “CANCELLED”. La API y el modelo de datos usan `draft`, `sent`, `accepted`, `rejected`, `expired`. Conviene unificar: o bien la UI envía los valores que acepta la API (en minúsculas y con accepted/rejected/expired en lugar de ARCHIVED/CANCELLED), o bien la API acepta también los valores que muestra la UI.
- **Visibilidad de Ventas:** El ítem “Ventas” del menú de partners está condicionado por rol (`SUPERADMIN` en el código). Si los partners deben usar ventas, facturas y estados de cuenta, hay que ampliar los roles que ven ese ítem (por ejemplo `org_admin`, `sales_user`) en el sidebar.

*(Este apartado se puede ir actualizando al encontrar más discrepancias.)*

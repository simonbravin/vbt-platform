# Plan: Traducción completa de la plataforma (ES/EN)

## Regla obligatoria (para cualquier cambio futuro)

**Siempre que se agregue o modifique texto visible al usuario:**

- Usar claves i18n en lugar de texto hardcodeado.
- **Añadir la clave en inglés y en español** en `apps/web/src/lib/i18n/translations.ts` (bloques `en` y `es`).
- En client components: `useT()` y `t("namespace.key")`.
- En server components: cookie `NEXT_LOCALE` + `getT(locale)` y `t("namespace.key")`.

Ver también la regla de Cursor en `.cursor/rules/i18n-spanish-required.mdc`.

---

## Objetivo
Que el toggle de idioma (ENG/ESP) en la barra superior cambie **todo** el contenido de la app, no solo el sidebar. Eliminar texto hardcodeado y unificar bajo el sistema de claves i18n existente.

## Estado de implementación (resumen)

| Área | Estado | Notas |
|------|--------|--------|
| Parte 1 – Infra + cookie + getT | ✅ Hecho | Cookie `NEXT_LOCALE`, `getT(locale)`, `<html lang>`, persistencia |
| Parte 2 – Auth | ✅ Hecho | Login, signup, forgot/reset, pending, invite/accept |
| Parte 3 – TopBar / layout | ✅ Hecho | View as, Platform (all), Loading, notificaciones |
| Parte 4 – Dashboard (partner) | ✅ Hecho | Títulos, KPIs, GoalKpiCard, enlaces, errores |
| Parte 5 – Projects | ✅ Hecho | Listado, nuevo, detalle, logs |
| Parte 6 – Clients | ✅ Hecho | ClientsClient, ClientDetailActions: formularios, errores, vacíos, vistas tarjeta/tabla |
| Parte 7 – Quotes | ✅ Hecho | Listado, create, new (wizard steps 1–6), detalle [id] |
| Parte 8 – Admin | ✅ Hecho | Users, entities, catalog, warehouses, countries, freight, taxes, settings, inventory |
| Parte 9 – Superadmin | ✅ Hecho | Dashboard, Partners, Activity, GlobalSettings, Analytics, DocumentsAdmin, Reports, Training, CreatePartnerForm |
| Parte 10 – Partner (Sales, Engineering, Documents, Training, Reports, Settings, Team) | ✅ Hecho | ReportsClient, StatementsClient, SalesClient, SaleDetailClient, EditSaleClient, TrainingPartnerClient; TeamSettingsClient; PartnerDetailClient, EditPartnerForm; ProjectDetailClient (Save/Create client/Company name) |
| Parte 11 – UI compartida | ⏳ Opcional | Toasts genéricos; la mayoría de mensajes usan ya common.* / módulo.* |
| Parte 12 – Revisión final | ⏳ Opcional | Fechas/números con locale, validación Zod, emails |
| PDF cotización (`quote-pdf.tsx`) | ✅ Hecho | Locale desde cookie; todas las secciones y etiquetas traducidas (pdf.quote.*) |

## Estado actual (detalle)
- **i18n**: `LanguageProvider` + `useLanguage()` / `useT()` en `@/lib/i18n/context.tsx`. Traducciones en `translations.ts` (en / es).
- **Persistencia**: Cookie `NEXT_LOCALE`; `getT(locale)` para server components; `<html lang={locale}>` en layout.

## Infraestructura a añadir

1. **Cookie de idioma**
   - Nombre: `NEXT_LOCALE` (valor `en` o `es`).
   - Al cambiar el toggle en TopBar: además de `setLocale()`, escribir la cookie (ej. `document.cookie = "NEXT_LOCALE=es; path=/; max-age=31536000"`).
   - En `LanguageProvider`: en el primer render, leer la cookie y usarla como estado inicial de `locale` (para que al recargar se mantenga el idioma).

2. **Traducciones en server components**
   - Muchas páginas son Server Components (dashboard, projects, etc.) y no pueden usar `useT()`.
   - Opción A: Exportar `getT(locale: Locale)` desde `@/lib/i18n/translations.ts` que devuelva `(key: string) => string`, y en cada server component hacer `const locale = (await cookies()).get("NEXT_LOCALE")?.value ?? "en"` y `const t = getT(locale as Locale)`.
   - Opción B: Convertir a Client Component solo la parte que muestra texto (wrapper que recibe datos y usa `useT()`).
   - **Recomendación**: Opción A para no duplicar lógica; usar `getT(locale)` en server components y seguir usando `useT()` en client components.

3. **Archivo de soporte**
   - Crear `apps/web/src/lib/i18n/server.ts` (o añadir en `translations.ts`): `getT(locale: Locale)` que devuelva una función `(key: string, vars?: Record<string, string|number>) => string` usando el mismo diccionario que el cliente.

---

## Partes del plan (por áreas)

### Parte 1 – Infraestructura y persistencia
- Añadir cookie `NEXT_LOCALE` al cambiar idioma en TopBar.
- Inicializar `LanguageProvider` con el valor de la cookie si existe.
- Exportar `getT(locale)` (y opcionalmente `getLocaleFromCookies()` en cliente) en `lib/i18n`.
- Ajustar `<html lang={locale}>` desde el layout (puede ser un client wrapper que lea locale y ponga el atributo).

### Parte 2 – Auth (login, signup, forgot, reset, pending, invite/accept)
- Revisar que todas las cadenas usen claves ya existentes; añadir las que falten en `translations.ts` (en + es).
- Sustituir cualquier texto hardcodeado restante por `t("auth.xxx")`.

### Parte 3 – TopBar y layout global
- TopBar: "View as", "Platform (all)", "Loading..." (notificaciones), etc. → claves `topbar.viewAs`, `topbar.platformAll`, `common.loading`.
- Footer del sidebar: "VBT Platform v1.0" / "Plataforma VBT v1.0" / "Superadmin Portal" si aplica.
- Cualquier otro texto en layout compartido.

### Parte 4 – Dashboard (partner)
- Página principal del dashboard: títulos, botones, mensajes de error ("Unable to load dashboard data", "Retry"), KPIs, enlaces "Review →".
- Componente `GoalKpiCard`: textos.
- Usar en server component `getT(locale)` leyendo cookie; o extraer a un Client que use `useT()`.

### Parte 5 – Projects (listado, nuevo, detalle, logs)
- Projects list, New Project, Project detail, Project logs.
- Sustituir todos los textos visibles por claves (projects.*, common.*).
- Añadir claves que falten (en + es) y usar `t()` o `getT(locale)` según sea client o server.

### Parte 6 – Clients
- ClientsClient ya usa `useT()`; revisar que no queden strings sueltos.
- Páginas de detalle de cliente y acciones: pasar todo a claves.

### Parte 7 – Quotes (listado, creación por pasos, detalle, PDF)
- Quotes list, new quote (steps 1–6), quote detail, preview, PDF.
- Componentes en `components/quotes/`: step1-method, step2-csv, step3-material, step4-commission, step5-destination, step6-preview.
- PDF: `quote-pdf.tsx` – si el PDF se genera con texto, aceptar `locale` o claves y traducir etiquetas.

### Parte 8 – Admin (users, entities, catalog, warehouses, countries, freight, taxes, settings, inventory)
- Todas las páginas bajo `(dashboard)/admin/` y las que viven bajo `(superadmin)/superadmin/admin/` reutilizando los mismos client components.
- Revisar UsersClient, EntitiesClient, catalog, warehouses, countries, freight, taxes, settings, inventory: reemplazar strings por claves `admin.*` y `common.*`.
- Las claves en `translations.ts` ya existen en muchos casos; solo falta usarlas en el JSX.

### Parte 9 – Superadmin (dashboard, partners, analytics, reports, activity, documents, training, settings)
- Superadmin dashboard, partners list/detail/create/edit, analytics, reports, activity feed, documents, training, global settings.
- Añadir claves `superadmin.*` donde haga falta y sustituir texto hardcodeado.

### Parte 10 – Sales, Engineering, Documents, Training, Reports, Settings (partner)
- Sales (list, new, detail, edit, statements), Engineering (list, new, detail), Documents, Training, Reports, Settings (overview, team).
- Unificar etiquetas, botones y mensajes con claves (sales.*, engineering.*, documents.*, training.*, reports.*, settings.*).

### Parte 11 – UI compartida y mensajes de error
- Componentes en `components/ui/` (toast, alert, etc.): si tienen texto por defecto, usar claves.
- Mensajes genéricos ("Loading...", "No data", "Error", "Cancel", "Save") deben salir de `common.*`.
- Revisar `use-toast` y toaster por mensajes hardcodeados.

### Parte 12 – Revisión final y textos dinámicos
- Fechas y números: asegurar `toLocaleString(locale, ...)` donde se formatee fecha/moneda.
- Validación (Zod): mensajes de error en formularios; si están en inglés, considerar claves `validation.*`.
- Revisar emails (templates): si se envían en un solo idioma, dejarlo documentado; si en el futuro se quieren en ES/EN, preparar claves o plantillas por idioma.

---

## Orden de ejecución sugerido
1. **Parte 1** (infra + cookie + getT).
2. **Parte 2** (auth).
3. **Parte 3** (topbar + layout).
4. **Parte 4** (dashboard).
5. Luego **Partes 5–12** en el orden listado, o agrupando 5–6, 7, 8, 9, 10–11 según prioridad.

## Convenciones
- Claves por módulo: `auth.*`, `nav.*`, `dashboard.*`, `projects.*`, `clients.*`, `quotes.*`, `admin.*`, `superadmin.*`, `sales.*`, `engineering.*`, `documents.*`, `training.*`, `reports.*`, `settings.*`, `common.*`, `topbar.*`, `notifications.*`.
- Siempre añadir la clave en **en** y **es** en el mismo bloque para no desincronizar.
- En server components: `const t = getT(locale)`; en client: `const t = useT()`.
- Para atributo `lang` del `<html>`: si el layout raíz es server component, se puede leer la cookie ahí y pasar `lang={locale}`; si no, un client wrapper que lea el contexto y actualice el documento.

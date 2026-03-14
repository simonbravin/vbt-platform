# Frontend Architecture & Product Plan: Dual-Portal SaaS

Vision Latam platform evolution to support **Superadmin Portal** and **Partner Portal** from one product, with shared backend, APIs, and data model. Vision Latam may operate both as platform owner and as an internal partner in some markets.

**Scope:** Architecture and product plan only. No UI implementation in this document.

---

## Section 1: Recommended Product Architecture

### Recommendation: **One app, role and context–driven shells with distinct route groups**

Use a **single Next.js app** with two top-level route groups that act as “portal shells”:

- **`/superadmin/*`** — Platform owner experience (global visibility, partner management, configuration, reports).
- **`/(partner)/*`** — Partner experience (org-scoped data, operational modules, partner-level settings).

**Alternative considered:** Separate apps (e.g. `apps/superadmin`, `apps/partner`). Rejected because:

- Duplication of shared domain logic, API clients, validation, and design system.
- Two deploy pipelines and two frontends to keep in sync with the same backend.
- Harder to support “Vision Latam as partner”: would require separate login or awkward cross-app flow.

### Why one app with route groups

1. **Single codebase**  
   Shared components, hooks, API layer, and types. One design system and one set of tests.

2. **Clear URL and layout boundary**  
   `/superadmin/partners`, `/superadmin/analytics` vs `/projects`, `/quotes`, `/settings`. Users and support can reason about “which portal I’m in.”

3. **Unified auth and session**  
   Same session; `activeOrgId` and `isPlatformSuperadmin` drive redirect and shell selection. No separate login for “Vision Latam as partner” vs “Vision Latam as platform.”

4. **Vision Latam dual role**  
   - Superadmin users: can open **Superadmin Portal** (platform) and, when they have an `activeOrgId` (e.g. Vision Latam internal org), can switch to **Partner Portal** for that org.  
   - Non-superadmin users: only see Partner Portal for their org.  
   - One app can render the correct shell and navigation from session + feature flags.

5. **Incremental migration**  
   Current internal frontend lives under a single `(dashboard)` group. Migration path: introduce `(partner)` and `(superadmin)` groups, move and refactor routes into the right shell, then deprecate or narrow `(dashboard)`.

### High-level routing structure

```
/                          → redirect by role/context (see below)
/login
/pending

/superadmin                → layout: superadmin shell (sidebar + topbar)
  /superadmin/dashboard
  /superadmin/partners
  /superadmin/partners/[id]
  /superadmin/territories   (or under partners/[id]/territories)
  /superadmin/analytics
  /superadmin/reports
  /superadmin/documents
  /superadmin/training
  /superadmin/settings      (global defaults, pricing, module visibility)
  /superadmin/partners/[id]/settings  (partner overrides)

/(partner)                  → layout: partner shell (sidebar + topbar)
  /dashboard                (or /partner/dashboard if you want /partner prefix)
  /projects
  /clients
  /quotes
  /engineering
  /documents
  /training
  /reports                  (org-scoped)
  /settings                 (org-level: users, warehouses, freight, tax, markup if allowed)
  /org-members
```

**Root redirect logic:**

- Not authenticated → `/login`.
- Authenticated, no `activeOrgId` and not superadmin → `/pending`.
- Superadmin with no `activeOrgId` or “platform context” chosen → `/superadmin/dashboard`.
- Superadmin with `activeOrgId` and “partner context” chosen, or non-superadmin with `activeOrgId` → `/(partner)` (e.g. `/dashboard`).

**Context switching (superadmin only):**  
A control in the topbar (e.g. “Switch to Partner view” / “Switch to Platform view”) or an org switcher that sets “I’m operating as platform” vs “I’m operating as org X.” That choice can be stored in session or client state and used by the root layout to redirect to the correct shell.

### Summary

| Aspect              | Choice                                                                 |
|---------------------|------------------------------------------------------------------------|
| Apps                | One app (e.g. `apps/web`)                                              |
| Portal separation   | Two route groups: `superadmin`, `partner` (plus auth/pending)          |
| Layouts             | One layout per portal (different sidebar + optional topbar content)     |
| Auth                | Shared; session drives portal and org context                          |
| Vision Latam dual   | Same app; superadmin can switch context to partner portal for an org  |

---

## Section 2: Superadmin Portal Information Architecture

### Purpose

Full global visibility, partner lifecycle management, global configuration, and platform-wide reporting. Only platform superadmins see this portal.

### Sidebar / navigation structure

- **Dashboard**  
  Global KPIs, partner leaderboard, pipeline and quote analytics across all partners, recent activity.

- **Partners**
  - List (filters: status, type, country)
  - Partner detail (profile, contacts, status)
  - Sub: **Territories** (list/add/remove per partner)
  - Sub: **Onboarding** (state, checklist)
  - Sub: **Settings** (partner-specific overrides: pricing, module visibility, allowed config)

- **Analytics & reports**
  - Analytics hub (pipeline, partner performance, quote analytics, leaderboard; filters: partner, date range, country)
  - Global reports (exports: by partner, by region, by period; PDF/Excel where applicable)

- **Content & enablement**
  - Document library (platform-wide; visibility: public, partners_only, internal; country scope)
  - Training (programs, enrollments across orgs, completion)

- **Configuration**
  - **Global settings**  
    Default pricing (margins, markups), global defaults for freight/tax behavior, feature flags, module visibility defaults.
  - **Partner overrides**  
    Per-partner pricing, allowed overrides (warehouses, freight, tax, markup), lock/unlock of specific settings.

- **Admin (optional grouping)**
  - Users (platform-level user list if needed)
  - Entities (if retained for legacy)
  - Audit / activity (global activity log, filtered by partner, action, date)

### Major pages (Superadmin)

| Page                     | Purpose                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| `/superadmin/dashboard`  | Global KPIs, leaderboard, pipeline, recent activity                     |
| `/superadmin/partners`   | Partner list, filters, create partner                                  |
| `/superadmin/partners/[id]` | Partner profile, status, contacts, links to territories/onboarding/settings |
| `/superadmin/partners/[id]/territories` | Manage territories for partner                         |
| `/superadmin/partners/[id]/onboard`     | Onboarding state and checklist                        |
| `/superadmin/partners/[id]/settings`   | Partner overrides (pricing, modules, locks)           |
| `/superadmin/analytics`  | Pipeline, partner performance, quotes, leaderboard; filters             |
| `/superadmin/reports`     | Global reports, export (PDF/Excel)                                     |
| `/superadmin/documents`   | Document library admin (CRUD, visibility, country)                    |
| `/superadmin/training`    | Programs and enrollments                                               |
| `/superadmin/settings`    | Global defaults: pricing, module visibility, feature flags              |
| `/superadmin/activity`    | Global activity log                                                    |

### Settings areas (Superadmin)

- **Global settings**  
  Pricing defaults (e.g. default markup %, margin rules), default module visibility, which settings partners can override, global freight/tax defaults (if applicable).

- **Per-partner settings**  
  Override pricing, enable/disable modules for partner, allow partner to edit warehouses/freight/tax/markup (or lock), document/training access rules.

---

## Section 3: Partner Portal Information Architecture

### Purpose

Operate a single organization (tenant): clients, projects, quotes, engineering, documents, training, and org-level configuration within the bounds set by the platform.

### Sidebar / navigation structure

- **Dashboard**  
  Org-scoped: pipeline, recent projects/quotes, activity, optional widgets (e.g. quote conversion).

- **CRM / operations**
  - **Projects** (list, detail, new; status, client, search)
  - **Clients** (list, detail, new)
  - **Quotes** (list, detail, create from project; status, search)
  - **Engineering** (requests list, detail, create; status)

- **Content & enablement**
  - **Documents** (filtered by visibility/country; view/download)
  - **Training** (programs, my enrollments, progress)

- **Reports**  
  Org-scoped reports (projects, quotes, pipeline); export PDF/Excel as today.

- **Settings**
  - **Team / org members** (list, invite, roles: owner, admin, sales, engineer, viewer)
  - **Operational settings** (only if allowed by platform):
    - Warehouses
    - Freight rules
    - Tax rules
    - Partner markup / pricing (if override enabled)

### Major pages (Partner)

| Page              | Purpose                                              |
|-------------------|------------------------------------------------------|
| `/dashboard`      | Org pipeline, recent projects/quotes, activity       |
| `/projects`       | Project list, filters, new                            |
| `/projects/[id]`  | Project detail, quotes, engineering links             |
| `/projects/new`   | Create project                                       |
| `/clients`        | Client list, filters                                 |
| `/clients/[id]`   | Client detail, projects                               |
| `/quotes`         | Quote list, filters, create from project            |
| `/quotes/[id]`    | Quote detail, edit, send, duplicate                   |
| `/quotes/create`  | Create quote (select project)                         |
| `/engineering`    | Engineering requests list                            |
| `/engineering/[id]` | Request detail, files, deliverables                 |
| `/documents`      | Document library (read)                              |
| `/training`       | Programs and enrollments                             |
| `/reports`        | Org reports, exports                                 |
| `/settings`       | Org settings hub (members + operational)            |
| `/settings/members` | Org members (list, invite, role/status)            |
| `/settings/warehouses` | Warehouses (if allowed)                         |
| `/settings/freight`    | Freight rules (if allowed)                        |
| `/settings/taxes`     | Tax rules (if allowed)                           |
| `/settings/pricing`   | Markup/pricing (if override allowed)              |

### Settings areas (Partner)

- **Team:** Org members, roles, invites. Visible to owner/admin (and optionally others in read-only).
- **Operational:** Warehouses, freight, tax, pricing. Visibility and editability depend on **configuration model** (Section 5): only show and allow edit where the platform has granted override.

---

## Section 4: Permission Matrix

Roles used in the matrix (aligned with backend and existing API):

- **Platform superadmin** — Platform-level role; not tied to a single org; can access Superadmin Portal and (optionally) switch to Partner Portal for an org.
- **Partner owner** — Org-level; maps to `owner` in API, stored as `org_admin`; full org admin.
- **Partner admin** — Org-level; maps to `admin`, stored as `org_admin`; same as owner for most UI intents.
- **Sales user** — `sales_user`; sales and quoting.
- **Engineer user** — `technical_user`; engineering requests and technical workflows.
- **Viewer** — `viewer`; read-only.

### Visible modules

| Module           | Superadmin (platform) | Owner/Admin | Sales | Engineer | Viewer |
|-----------------|------------------------|-------------|-------|----------|--------|
| Superadmin Portal | ✓ (full)             | ✗           | ✗     | ✗        | ✗      |
| Partner Dashboard | ✓ (when in partner context) | ✓ | ✓    | ✓        | ✓      |
| Projects        | ✓ (partner context)   | ✓           | ✓     | ✓        | ✓      |
| Clients         | ✓                     | ✓           | ✓     | ✓        | ✓      |
| Quotes          | ✓                     | ✓           | ✓     | ✓        | ✓      |
| Engineering     | ✓                     | ✓           | ✓     | ✓        | ✓      |
| Documents       | ✓                     | ✓           | ✓     | ✓        | ✓      |
| Training        | ✓                     | ✓           | ✓     | ✓        | ✓      |
| Reports (org)   | ✓                     | ✓           | ✓     | ✓        | ✓      |
| Org members     | ✓                     | ✓           | ✗     | ✗        | ✗ (or list only) |
| Warehouses      | ✓ (if allowed)        | ✓ (if allowed) | ✗  | ✗        | ✗      |
| Freight rules   | ✓ (if allowed)        | ✓ (if allowed) | ✗  | ✗        | ✗      |
| Tax rules       | ✓ (if allowed)        | ✓ (if allowed) | ✗  | ✗        | ✗      |
| Pricing/markup  | ✓ (if allowed)        | ✓ (if allowed) | ✗  | ✗        | ✗      |

### Allowed actions (examples)

| Action                    | Superadmin | Owner/Admin | Sales | Engineer | Viewer |
|---------------------------|------------|-------------|-------|----------|--------|
| Create/edit/delete partner| ✓          | ✗           | ✗     | ✗        | ✗      |
| Assign territories        | ✓          | ✗           | ✗     | ✗        | ✗      |
| Set onboarding state      | ✓          | ✗           | ✗     | ✗        | ✗      |
| Manage org members        | ✓ (in org) | ✓           | ✗     | ✗        | ✗      |
| Create/edit projects      | ✓          | ✓           | ✓     | ✓ (or ✗) | ✗      |
| Create/edit quotes        | ✓          | ✓           | ✓     | ✗        | ✗      |
| Create/edit engineering   | ✓          | ✓           | ✓     | ✓        | ✗      |
| Upload documents (org)    | ✓          | ✓ (if allowed) | ✗  | ✗        | ✗      |
| Edit warehouses/freight/tax/pricing (org) | ✓ (if allowed) | ✓ (if allowed) | ✗ | ✗ | ✗ |
| View global analytics     | ✓          | ✗           | ✗     | ✗        | ✗      |
| Export reports (org)      | ✓          | ✓           | ✓     | ✓        | ✓ (or ✗) |
| View documents/training    | ✓          | ✓           | ✓     | ✓        | ✓      |

### Restricted actions (explicit)

- **Only superadmin:** Create/update/delete partners; assign/remove territories; set onboarding; global settings; global analytics; global document/training admin; set partner-level overrides and locks.
- **Only owner/admin (within org):** Invite/remove members; change roles; access org-level settings (warehouses, freight, tax, pricing) when the platform has granted override.
- **Sales:** No org member management; no configuration (warehouses, freight, tax, pricing).
- **Engineer:** No quote creation/edit if product rules say so; no org members or config.
- **Viewer:** No create/edit/delete on operational entities; read-only everywhere in Partner Portal.

---

## Section 5: Configuration Inheritance Model

### Principles

- **Global defaults** live in platform (superadmin) and apply to all partners unless overridden.
- **Partner overrides** are optional and stored per partner (organization); they apply only when set and when the partner is allowed to use that dimension (e.g. markup).
- **Inheritance:** Partner sees “effective” value = partner override if present and allowed, else global default.
- **Locks:** Superadmin can lock a dimension so the partner cannot change it (partner sees global default or existing override as read-only).

### Dimensions

| Dimension           | Global default (superadmin) | Partner override | Partner can edit? | Inherited by |
|--------------------|-----------------------------|------------------|--------------------|--------------|
| **Default markup %** | Yes (e.g. default partner markup) | Optional % per partner | Only if “allow markup override” | Quotes, pricing logic |
| **Pricing rules**   | Default margins, fee modes   | Partner-specific margins/fees | Only if allowed   | Quote creation, engineering fees |
| **Warehouses**      | (Optional global list)       | Org-level list   | Only if “allow warehouse config” | Inventory, operations |
| **Freight rules**   | Default rules or templates   | Org-level rules  | Only if “allow freight config”   | Shipping, quote calc |
| **Tax rules**       | Default tax rules            | Org-level rules  | Only if “allow tax config”       | Invoicing, quote calc |
| **Module visibility** | Default on/off per module | Per-partner on/off | No (superadmin only) | Partner sidebar + features |
| **Document access** | Visibility + country scope    | (Future: per-partner doc visibility) | No | Document library filter |
| **Training access** | Program visibility            | (Future: per-partner program access) | No | Training catalog |

### What is global-only

- Partner creation, territory assignment, onboarding state.
- Global default values for markup, margins, pricing rules.
- Default module visibility (which modules exist and are on by default).
- Document and training platform content (visibility/country at platform level).
- Feature flags that enable/disable partner overrides (e.g. “partners can override markup”).

### What is partner-editable (when allowed)

- **Org members** (owner/admin): invite, remove, change role.
- **Warehouses** (if “allow warehouse config” for that partner): CRUD org-level warehouses.
- **Freight rules** (if allowed): CRUD org-level freight rules.
- **Tax rules** (if allowed): CRUD org-level tax rules.
- **Partner markup / pricing** (if “allow pricing override”): set markup % or pricing rules for that org.

### What is inherited

- **Effective markup:** If no partner override → use global default. If override set and not locked → use override.
- **Effective visibility of modules:** If no partner override → use global default. Superadmin can hide a module for a partner (override to off).
- **Documents/training:** Partner sees content that matches their org’s visibility and country; platform defines the rules.

### What can be overridden (and locked)

- Default markup % (override per partner; superadmin can lock).
- Per-partner pricing/margin rules (override; lock possible).
- Module visibility (override per partner; superadmin only).
- “Allow this partner to edit warehouses/freight/tax/pricing” (superadmin toggles; no “override value,” just capability).

### What the superadmin can lock

- Any partner override dimension can be locked so the partner cannot change it (read-only in Partner Portal; value can still be set by superadmin in Superadmin Portal).

### Product/UX implications for pricing

- **Partner Portal – Settings / Pricing:**  
  Show “Default markup” (and any other effective pricing) with a clear indication: “From platform default” vs “Your override: X%.” If override is allowed, show form to edit; if locked, show value with “Locked by platform” (or similar).

- **Quote creation:**  
  Use effective markup (and any effective pricing rules) for the current org; no need to expose “global vs override” in the quote form, only the resulting behavior.

- **Superadmin – Partner settings:**  
  For each partner: set overrides (markup %, pricing rules), checkboxes for “allow partner to edit warehouses/freight/tax/pricing,” and locks per dimension. Clear labels: “Default (inherited)” vs “Override” vs “Locked.”

- **Reporting:**  
  Global reports can show “by partner” and “effective pricing” for analytics; partner reports only show their own effective values.

---

## Section 6: Reusable Frontend Architecture

### Shared layouts

- **Root layout**  
  Auth check, session load, redirect by role/context (login, pending, superadmin, partner).

- **Superadmin layout**  
  Superadmin shell: sidebar (Superadmin IA), topbar (user, context switch to partner if applicable, logout). Single layout for all `/superadmin/*`.

- **Partner layout**  
  Partner shell: sidebar (Partner IA, items filtered by role and module visibility), topbar (org name, user, logout; optional org switcher for superadmin). Single layout for all `/(partner)/*`.

Shared between both: topbar pattern (user menu, logout), sidebar pattern (nav items, active state, roles), and any shared header/footer for branding.

### Shared table components

- **DataTable (generic)**  
  Columns config, sort, pagination, row actions, selection (optional). Used in: project list, client list, quote list, partner list, org members, etc.

- **Filters bar**  
  Reusable filter UI (status, date range, search, partner/country for superadmin). Same component with different filter config per page.

- **Empty / loading / error states**  
  Shared empty state, skeleton, and error message components for tables and detail views.

### Shared forms

- **Form primitives**  
  Input, Select, DatePicker, Checkbox, etc., with consistent validation (e.g. Zod + react-hook-form) and error display.

- **Entity forms**  
  Project form, Client form, Quote form (with line items), Engineering request form. Used in both “create” and “edit”; same form component, different initial values and submit target (POST vs PATCH).

- **Settings forms**  
  Markup %, pricing rules, warehouse, freight, tax: shared field components and layout; superadmin vs partner only changes which fields are visible/editable and which API is called.

### Shared filters

- **Filter state**  
  URL query params or client state for: status, dateFrom/dateTo, search, partnerId (superadmin), country, limit/offset. Reusable hook (e.g. `useTableFilters`) that returns current values and setters and syncs with URL.

- **Filter UI**  
  Same filter bar component; each page passes filter config (which filters apply and options).

### Shared entity detail pages

- **Detail layout**  
  Title, breadcrumb, action bar (edit, delete, state-specific actions), tabs or sections (e.g. Overview, Quotes, Activity). Reuse for: project detail, client detail, quote detail, partner detail, engineering request detail.

- **Action bar**  
  Role-aware: same component receives “allowed actions” from a permission helper (e.g. `getQuoteActions(role, quoteStatus)`) and renders buttons/links accordingly.

### Role-aware action bars

- **Helper:** `getActions(entityType, entity, role, permissions)`  
  Returns list of { id, label, href?, onClick?, variant, disabled? }. Used by detail pages and list rows.

- **Usage:**  
  Partner quote detail: “Edit” (sales/admin), “Send” (sales/admin), “Duplicate” (sales/admin). Superadmin partner detail: “Edit partner,” “Territories,” “Onboarding,” “Settings.” No new components; only config and permission logic.

### Reusable analytics widgets

- **Widgets:**  
  KPI cards (number + label + optional trend), small bar/line charts (pipeline by status, quotes over time), leaderboard table (partner name, metrics, rank), recent activity list.

- **Data source:**  
  Each widget calls the same dashboard/analytics API with params (orgId for partner, partnerId/country for superadmin). Same component, different props (title, endpoint, params).

- **Placement:**  
  Superadmin dashboard: global pipeline, leaderboard, partner performance. Partner dashboard: org pipeline, recent projects/quotes, activity. Reuse the same widget components with different API params.

### Shared API and state

- **API client**  
  Single client (fetch or axios) with base URL, auth header from session, and helpers for GET/POST/PATCH/DELETE. All `/api/saas/*` and legacy endpoints go through it.

- **Queries / cache**  
  React Query (or SWR) for list/detail; keys include `orgId` and `portal` where relevant so superadmin and partner data do not mix.

- **Auth and context**  
  One `AuthProvider` (or session provider) exposing: user, role, activeOrgId, isPlatformSuperadmin, “portal context” (platform vs partner). Layouts and permission helpers consume this.

---

## Section 7: Migration Strategy from Current Frontend

### Current state (summary)

- Single `(dashboard)` layout and one sidebar.
- Routes: dashboard, projects, clients, quotes, sales, reports, admin (users, entities, catalog, warehouses, countries, freight, taxes, settings), inventory.
- Sidebar visibility by role: SUPERADMIN, ADMIN, SALES (and implied viewer); no clear split between “platform” and “partner.”
- Editable modules, export flows, PDF/Excel in places; navigation is internal-operations oriented.

### Reuse directly (with minimal changes)

- **Projects:** List, detail, new. Already org-scoped in backend. Move under `/(partner)/projects`, keep UI; switch data source to SaaS APIs if not already; apply role-based action bar.
- **Clients:** Same: move to `/(partner)/clients`, reuse list/detail/new.
- **Quotes:** List, detail, create from project. Move to `/(partner)/quotes`; already have SaaS create/update; reuse and align with new quote flow.
- **Dashboard (current):** Becomes Partner Dashboard. Move to `/(partner)/dashboard`; replace or augment data with `/api/saas/dashboard/*`.
- **Reports (current):** Org-scoped reports and exports. Move to `/(partner)/reports`; keep PDF/Excel; ensure APIs are org-scoped.
- **Document library (if any):** Read-only list/download. Move to `/(partner)/documents`; use SaaS document API filtered by visibility.
- **Training (if any):** Programs and enrollments. Move to `/(partner)/training`; use SaaS training APIs.

### Refactor (same concept, new shell or API)

- **Admin → split by portal**
  - **Users / org members:** Becomes Partner “Team” under `/(partner)/settings/members`; use `/api/saas/org-members`. Keep user list UI; restrict to current org; role mapping to owner/admin/sales/engineer/viewer.
  - **Entities:** If still needed, either superadmin-only (e.g. `/superadmin/entities`) or deprecated.
  - **Catalog:** Decide: superadmin-only content management or deprecated; no change in this plan.
  - **Warehouses, Freight, Taxes:** Move to `/(partner)/settings/warehouses` (etc.). Show only if partner has “allow warehouse/freight/tax config.” Use existing or new SaaS-style APIs; same form concepts, new routes and permission checks.
  - **Settings (org):** Becomes Partner settings hub: members + warehouses + freight + taxes + pricing (if allowed). Global “admin/settings” (e.g. org profile) can stay under partner settings or be split.
- **Sidebar:** Replace single nav with two configs: Superadmin sidebar (new) and Partner sidebar (derived from current nav, filtered by role and module visibility). Same `Sidebar` component, different nav config and layout.

### Superadmin-only (new or moved)

- **Partners:** New list/detail, territories, onboarding, partner settings. New pages under `/superadmin/partners/*`; use existing partner/territory/onboarding APIs.
- **Global analytics:** New page(s) under `/superadmin/analytics` using `/api/saas/analytics/*` with optional partner filter; reuse analytics widgets.
- **Global reports:** New or move from current reports; filter by partner/region; export; superadmin only.
- **Document/training admin:** If platform manages content, add `/superadmin/documents`, `/superadmin/training`; use document/training APIs with admin semantics.
- **Global settings:** New `/superadmin/settings` for default pricing, module visibility, feature flags; and per-partner override/lock in `/superadmin/partners/[id]/settings`.
- **Activity log:** Global activity view under `/superadmin/activity` (if backend supports it).

### Expose to partners later (partner portal)

- **Engineering requests:** Already in backend; add `/(partner)/engineering` list/detail/create; reuse concept from current internal flow if it exists.
- **Documents / training:** Already planned in Partner IA; ensure UI exists and uses SaaS APIs.
- **Pricing/markup settings:** When “allow pricing override” exists, add `/(partner)/settings/pricing` and use effective-value + override UX from Section 5.

### Deprecate or narrow (legacy)

- **Sales module (legacy):** Backend stubbed; no Sale model in new schema. Keep routes stubbed or redirect; hide from Partner sidebar until a new sales model exists. Do not remove yet to avoid breaking bookmarks.
- **Legacy quote wizard (`/quotes/new`):** CSV/Revit flow not in new schema. Hide from default nav or show “Legacy” with a clear path to new quote create; eventually deprecate.
- **Inventory (current):** Tied to warehouses; move under partner settings as “Inventory” only if warehouse config is allowed and product decides to expose it; otherwise hide or superadmin-only.
- **Countries (admin):** No CountryProfile in new schema. If only used for dropdowns, use static list or client/project countryCode; remove or repurpose admin countries page.

### Migration order (high level)

1. Introduce route groups and layouts: add `(superadmin)` and `(partner)`; keep `(dashboard)` working.
2. Implement Superadmin shell: sidebar + layout + redirect for superadmin; one or two pages (e.g. dashboard, partners list) to validate.
3. Move Partner-facing routes from `(dashboard)` to `(partner)`: dashboard, projects, clients, quotes; point to SaaS APIs; switch layout to Partner layout.
4. Add partner-only pages: engineering, documents, training, settings (members + operational where allowed).
5. Add Superadmin pages: partners (full CRUD + territories + onboarding + settings), analytics, global reports, global settings, partner overrides.
6. Align sidebar and permissions with Section 4; add role-aware action bars and module visibility from config.
7. Deprecate or hide legacy routes (sales, legacy quote wizard, etc.); document in MODULE-MIGRATION-STATUS.

---

## Section 8: Implementation Roadmap

Phases are incremental and assume one app, shared backend, and no big-bang rewrite.

### Phase 1: Shells and routing (foundation)

- **Goal:** Two portal shells and correct redirect by role/context.
- **Tasks:**
  - Add `(superadmin)` and `(partner)` route groups and layouts.
  - Implement root redirect: by session (activeOrgId, isPlatformSuperadmin) and, if needed, “context” (platform vs partner).
  - Superadmin layout: sidebar (nav config for Superadmin IA), topbar; placeholder dashboard.
  - Partner layout: sidebar (nav config for Partner IA), topbar; reuse or adapt current dashboard layout.
  - Context switcher (superadmin): “Platform” vs “Organization X” to toggle between superadmin and partner portal.
- **Outcome:** A superadmin can open both portals; a partner user only sees the partner portal. No content yet beyond placeholders.

### Phase 2: Superadmin shell cleanup and first pages

- **Goal:** Superadmin can manage partners and see global data.
- **Tasks:**
  - Partners list and detail (read); create/edit partner (POST/PATCH); use existing APIs.
  - Partner detail: sub-navigation or tabs for Territories, Onboarding, Settings (overrides).
  - Territories: list, add, remove per partner.
  - Onboarding: display and set state.
  - Superadmin dashboard: call global analytics/dashboard APIs (or mocks); show pipeline and leaderboard widgets.
- **Outcome:** Superadmin portal is usable for partner lifecycle and a first dashboard.

### Phase 3: Partner portal – core operations

- **Goal:** Partner users use the new shell for daily work.
- **Tasks:**
  - Move dashboard, projects, clients, quotes from current `(dashboard)` to `(partner)`; wire to SaaS APIs.
  - Projects: list, detail, new; filters and role-based actions.
  - Clients: list, detail; same.
  - Quotes: list, detail, create from project; status flow and duplicate.
  - Engineering: list, detail, create request; files/deliverables if in scope.
  - Org members: list, invite, edit role/status (owner/admin only); use org-members API.
- **Outcome:** Partner portal is the primary place for CRM and quoting; legacy dashboard routes can be redirected.

### Phase 4: Partner settings and configuration UI

- **Goal:** Partners can configure what the platform allows; superadmin can set defaults and overrides.
- **Tasks:**
  - Partner settings hub: members (done in Phase 3) + warehouses, freight, tax, pricing (placeholders or full UI if APIs exist).
  - Visibility: show warehouses/freight/tax/pricing only when “allowed” for that partner (from config or feature flag).
  - Superadmin global settings: page for default markup, default module visibility, and “allow override” toggles.
  - Superadmin partner settings: overrides (markup %, locks); “allow partner to edit warehouses/freight/tax/pricing.”
  - Effective-value UX: in partner pricing settings, show “From platform default” vs “Your override” and “Locked by platform” when applicable.
- **Outcome:** Configuration model (Section 5) is visible and editable in both portals; inheritance and locks are clear.

### Phase 5: Analytics and reporting UI

- **Goal:** Superadmin has global analytics and reports; partner has org-scoped reports.
- **Tasks:**
  - Superadmin analytics: pipeline, partner performance, quote analytics, leaderboard; filters (partner, date, country); reuse shared widgets.
  - Superadmin reports: global reports, export (PDF/Excel) by partner/region/period.
  - Partner reports: ensure existing report pages use org-scoped APIs; add or refine export.
  - Shared: reuse same chart/table widgets with different API params and permissions.
- **Outcome:** Both portals have the right level of reporting and export.

### Phase 6: Documents, training, and polish

- **Goal:** Content and enablement in both portals; cleanup.
- **Tasks:**
  - Partner documents: list and download; filter by visibility/country; use document API.
  - Partner training: programs list, enrollments, progress; use training APIs.
  - Superadmin document/training admin: if needed, CRUD and visibility/country for platform content.
  - Deprecate or hide: legacy sales, legacy quote wizard, unused admin pages; update sidebar and docs.
  - Permission matrix: final pass so every action bar and nav item respects Section 4.
- **Outcome:** Full dual-portal experience; legacy surface reduced and documented.

### Dependencies and order

- Phases 1 and 2 can start in parallel with backend work on “partner override” and “allow config” flags if not yet in place.
- Phase 3 depends on Phase 1 (partner layout and redirect).
- Phase 4 depends on a clear configuration model (backend or feature flags) for “allowed” and “locked.”
- Phase 5 and 6 can overlap; Phase 6 is the right time to deprecate legacy routes.

---

## Section 9: Open Product Decisions That Still Need Confirmation

1. **Vision Latam as partner – UX**  
   When a Vision Latam user is both superadmin and member of an “internal” org: default after login (platform vs partner), and whether “context switch” is a topbar dropdown, a separate “Open as partner” link, or a dedicated org switcher. Needs product decision.

2. **URL shape for partner portal**  
   Flat (`/dashboard`, `/projects`) vs prefixed (`/partner/dashboard`). Flat is simpler and shorter; prefix makes “which portal” obvious in the URL. Recommend flat; confirm with product.

3. **Sales module future**  
   Backend has no Sale model. Confirm whether to hide sales from nav for everyone, keep for superadmin only, or plan a future “sales” concept on the new schema and leave a placeholder.

4. **Inventory placement**  
   Whether inventory is partner-level (when warehouse config is allowed), superadmin-only, or deprecated until a new inventory model exists.

5. **Document/training admin**  
   Whether superadmin has full CRUD for documents and training programs or only visibility/country; and whether partners can upload org-scoped documents (and where that appears in the IA).

6. **Pricing override granularity**  
   Override at org level only, or also per-project/per-quote type; and whether “lock” is per dimension (e.g. lock markup but allow freight) or all-or-nothing per partner. Recommendation: org-level override + per-dimension lock; confirm.

7. **Module visibility default set**  
   Which modules are on by default for new partners (e.g. warehouses off until enabled); and whether “module” is a coarse list (e.g. “Warehouses”, “Freight”, “Tax”, “Pricing”) or finer (e.g. “Reports – export PDF”). Recommendation: coarse list first; confirm.

8. **Legacy quote wizard**  
   Keep under “Legacy” or “Other” in nav for a transition period, or remove from nav immediately and support only via direct URL. Product decision.

9. **Global activity log**  
   Whether superadmin has a dedicated “Activity” page with filters (partner, action, date) and what the backend exposes (e.g. from existing activity log). Confirm scope and API.

10. **Feature flags**  
    Whether “allow markup override,” “allow warehouse config,” etc. are stored in DB (partner profile or new config table) or in feature flags (e.g. LaunchDarkly). Affects Phase 4 implementation; recommend DB for per-partner control.

---

**Document version:** 1.0  
**Last updated:** (date)  
**Related docs:** MODULE-MIGRATION-STATUS.md, PARTNER-SYSTEM.md, ANALYTICS-SYSTEM.md, BACKEND-HARDENING.md

# Frontend audit – Edit, Export, persistence

Quick reference for which pages support **edit**, **export**, and that **changes persist**. Use this to verify flows before release.

## Partner portal `(dashboard)/*`

| Page | Edit | Export | API used | Notes |
|------|------|--------|----------|--------|
| **Dashboard** | — | — | SaaS dashboard APIs | Read-only; data reflects effectiveOrgId. |
| **Projects** | List → [id] detail: edit project (PATCH), new project (POST) | — | /api/saas/projects, /api/projects | Edit in ProjectDetailClient; persistence via PATCH. |
| **Clients** | List → [id]: edit client (PATCH), new client (POST) | — | /api/clients, /api/saas/* | ClientDetailActions; PATCH updates and refetch. |
| **Quotes** | List → [id]: edit status/notes (PATCH), delete (DELETE), duplicate | PDF download, Email | /api/quotes/[id], /api/quotes/[id]/pdf, /api/quotes/[id]/email | Quote detail uses legacy GET/PATCH; PDF/email from same id. **Partners must not see EXW/factory cost** (see pricing masking). |
| **Engineering** | New request (POST), [id] detail view | — | /api/saas/engineering | List and detail; create persists. |
| **Documents** | — | — | /api/saas/documents | Read-only list for partner. |
| **Training** | Enroll (POST), progress (PATCH enrollment) | — | /api/saas/training/* | Enrollments persist; progress update. |
| **Reports** | — | CSV, Excel, Email report | /api/reports/projects (format=csv|xlsx), /api/reports/email | Export uses current filters; email restricted to org_admin/superadmin. |
| **Settings** | Overview/Team (invite, PATCH member) | — | /api/saas/org-members | Team: invite and role changes persist. |

## Superadmin portal `(superadmin)/*`

| Page | Edit | Export | API used | Notes |
|------|------|--------|----------|--------|
| **Dashboard** | — | — | /api/saas/dashboard/* | KPIs and leaderboard. |
| **Partners** | New, [id] detail (Overview, Team, Territories, Onboarding, **Parameters**), edit | — | /api/saas/partners/* | Parameters tab: PATCH partners/[id] with fees, margins, targets; persists. |
| **Analytics** | — | CSV, Excel (leaderboard) | /api/saas/analytics/export | type=leaderboard&format=csv|xlsx. |
| **Activity** | — | — | /api/saas/dashboard/activity (or activity feed API) | Read-only. |
| **Documents** | Create, edit (PATCH) | — | /api/saas/documents | Admin CRUD. |
| **Training** | Programs list, enrollments list | — | /api/saas/training/* | View; enrollments per org. |
| **Global Settings** | Save pricing defaults, module visibility | — | GET/PATCH /api/saas/platform-config | Persists to platform_config. |
| **Global Reports** | — | CSV, Excel | /api/saas/analytics/export | Same export as Analytics hub. |

## Consistency checks

- **Quote detail** uses **legacy** `/api/quotes/[id]` for GET/PATCH. Tenant scope is applied; **partner price masking** is applied: for non–platform-superadmin users, GET returns no factory cost and returns `basePriceForPartner` = factory cost + Vision Latam commission % (from Global Settings). UI and PDF show "Base price (Vision Latam)" instead of "EXW (Factory cost)" for partners.
- **Pricing for partners (done):** Partners never see EXW or factory cost. Base price = factory cost + Vision Latam commission % (configurable in Superadmin → Global Settings → "Vision Latam commission %"). Masking applied in: GET /api/quotes/[id], GET /api/saas/quotes/[id], and GET /api/quotes/[id]/pdf when user is not platform superadmin.

## CSS and accessibility (reviewed)

- **Layout:** Dashboard main content uses `p-6`; pages use `space-y-6` for vertical rhythm. Headings: `text-2xl font-bold text-gray-900`, subtitles: `text-gray-500 text-sm mt-0.5`.
- **Forms and filters:** Inputs and selects use `rounded-lg border border-gray-300 px-3 py-2 text-sm` with `focus:outline-none focus:ring-2 focus:ring-vbt-blue focus:border-transparent`. Buttons: primary `bg-vbt-blue hover:bg-vbt-blue/90`, secondary `border border-gray-300 hover:bg-gray-50`. Apply filters with an "Apply" or "Search" button next to the search field.
- **Search bars:** Projects, Clients, Quotes, Reports: search + filters in a clear block; debounced or on Enter/Apply. Reports: filter grid (Status, Country, Client, Sold from/to) + search row with Apply.
- **Lists:** Tables use `rounded-xl shadow-sm border border-gray-100`, thead `bg-gray-50`, cells `px-4 py-3`. Cards use `rounded-xl border border-gray-200 bg-white shadow-sm`.

## How to verify

1. **Edit:** Change a field → Save → reload or navigate away and back; value should persist.
2. **Export:** Click CSV/Excel/PDF → file downloads with expected data and filters.
3. **Persistence:** After save, confirm no stale data (e.g. refetch or redirect so UI shows updated state).

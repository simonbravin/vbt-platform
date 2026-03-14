# Document Library

Platform-wide document catalog. Filtered by visibility and country scope; no organization scoping on documents themselves.

---

## 1. Architecture

- **Core service:** `packages/core/src/services/documents.ts`
- **API routes:** `apps/web/src/app/api/saas/documents/`
- **Scoping:** Documents do not have `organizationId`; they are platform-wide. Listing is filtered by `visibility` and `countryScope`. Create/update require an active org (for audit and `createdByUserId`).

---

## 2. Document model

| Field         | Description |
|---------------|-------------|
| title         | Document title |
| description   | Optional description |
| categoryId    | FK to DocumentCategory |
| fileUrl       | URL to the file |
| visibility    | `public` \| `partners_only` \| `internal` |
| countryScope  | Comma-separated country codes or `*` for all |
| documentType  | Optional type |
| version       | Version number |
| publishedAt   | Optional publish date |
| createdByUserId | User who created (optional) |

---

## 3. Visibility

| Value           | Meaning |
|-----------------|--------|
| `public`        | Visible to everyone |
| `partners_only` | Visible to authenticated partners |
| `internal`      | Internal only |

List API filters by these values and by `countryScope` (e.g. `PA`, `*`).

---

## 4. API Endpoints

| Method | Route | Description |
|--------|--------|-------------|
| GET    | `/api/saas/documents` | List documents (query: categoryId, categoryCode, visibility, countryScope, limit, offset). Platform-wide filter. |
| GET    | `/api/saas/documents/categories` | List document categories (no auth required; consider adding auth if needed). |
| POST   | `/api/saas/documents` | Create document (body: title, description, categoryId, fileUrl, visibility, countryScope). Requires active org. Logs `document_uploaded`. |
| GET    | `/api/saas/documents/[id]` | Get one document by id. |
| PATCH  | `/api/saas/documents/[id]` | Update document (title, description, categoryId, fileUrl, visibility, countryScope). Requires active org. |

---

## 5. Tenant rules

- **List/Get:** No tenant filter on document rows; filter by visibility and countryScope only.
- **Create/Update:** Require `requireActiveOrg()`; `createdByUserId` set on create. Activity log uses caller’s organizationId.

---

## 6. Activity Log

- **document_uploaded** — when a document is created via POST (entityType: `document`, entityId: document id).

---

## 7. Remaining gaps

- No file upload implementation (fileUrl assumed from external storage).
- Categories are platform-wide; no tenant-specific categories.
- No DELETE endpoint for documents (add if needed).

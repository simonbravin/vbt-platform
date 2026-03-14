# ERD Gap Analysis – Partner SaaS (Vision Latam)

This document reviews the **definitive ERD** for the multi-tenant partner SaaS and lists missing or ambiguous elements, plus recommendations.

---

## 1. Summary

The proposed ERD is **mostly complete** and aligns with multi-tenancy, roles, project workflow, quotes, engineering, documents, training, and activity logging. The following gaps and clarifications should be applied before or during implementation.

---

## 2. Foreign keys and naming

| Location | Issue | Recommendation |
|----------|--------|----------------|
| **org_members.invited_by** | No type/FK specified | Rename to `invited_by_user_id` and add FK to `users.id`. Optional (nullable) for members who signed up directly. |
| **project_claims.approved_by** | No type/FK specified | Rename to `approved_by_user_id` and add FK to `users.id`. Nullable; set when status is `approved` or `rejected`. |

---

## 3. Enums not fully defined in ERD

| Entity / Field | ERD | Recommendation |
|----------------|-----|----------------|
| **org_members.status** | Not enumerated | Add enum: `active`, `inactive`, `invited`, `suspended`. Default `active` for accepted members; `invited` until first login or acceptance. |
| **quotes.status** | Not listed | Add enum: `draft`, `sent`, `accepted`, `rejected`, `expired`. |
| **quote_items.item_type** | Not enumerated | Add enum: `product`, `service`, `other` (or keep String for flexibility). |
| **partner_profiles.partner_type** | Not in list | Align with org types: `commercial_partner`, `master_partner` (subset of organization_type). |
| **partner_profiles.engineering_fee_mode** | Not enumerated | Add enum: `fixed`, `percent`, `per_request`, `included`. |
| **documents.visibility** | Not enumerated | Add enum: `public`, `partners_only`, `internal`. |
| **documents.document_type** | Not enumerated | Optional enum: `pdf`, `video`, `link`, `other` or keep String. |

---

## 4. Document library scope

- **document_categories** and **documents** have **no organization_id** in the ERD.
- Interpretation: **platform-wide** library (Vision Latam publishes; partners consume).
- Filtering is by **visibility** and **country_scope** (and optionally language_code).
- If in the future you need **per-partner document sets**, add `organization_id` (nullable) to `documents` and treat `null` as “platform” and non-null as “partner-specific”. Not required for v1.

---

## 5. Session and active organization

- **activeOrgId** is not a table in the ERD; it is **session state**.
- Store in NextAuth session (e.g. JWT): `userId`, `activeOrgId`, `roles` (for active org), `isPlatformSuperadmin`.
- No new DB table is required; optionally persist `last_active_org_id` on `users` or in a small `user_preferences` table for “remember last org” on next login.

---

## 6. Quote versioning and uniqueness

- **quotes** has `quote_number` and `version`.
- Recommended uniqueness: **per organization**, e.g. `(organization_id, quote_number, version)` unique, so the same logical quote can have multiple versions.
- If `quote_number` is globally unique, then `version` is just metadata; typically `quote_number` is unique per org and version differentiates revisions.

---

## 7. Users and NextAuth

- For NextAuth compatibility, consider adding to **users**:
  - `email_verified` (DateTime?, optional)
  - `image` (String?, optional)
- **password_hash** is already present; keep it for Credentials provider.

---

## 8. Indexes (multi-tenant and performance)

Ensure indexes for:

- Every **organization_id** (and **client_id** where used) for tenant-scoped queries.
- **activity_logs**: `(organization_id, created_at)`, `(entity_type, entity_id)`.
- **projects**: `(organization_id, status)`, `(organization_id, client_id)`.
- **quotes**: `(organization_id, project_id)`, `(organization_id, quote_number, version)`.
- **engineering_requests**: `(organization_id, status)`.
- **training_enrollments**: `(organization_id, user_id)`, `(user_id, training_program_id)`.

---

## 9. Optional improvements (not blocking)

| Item | Comment |
|------|--------|
| **Soft deletes** | No `deleted_at` in ERD. Add later if you need audit-friendly “archive” without hard delete. |
| **project_claims** | Consider `rejected_by_user_id` and `rejected_at` if you need to track who rejected and when. |
| **Quote currency** | ERD has `currency`; use ISO code (e.g. String, 3 chars). |
| **engineering_fee_value** | In **engineering_requests**: clarify if this is fixed amount or percent; could add `engineering_fee_type` (fixed / percent) if both are used. |

---

## 10. What is not missing

- **Multi-tenancy**: All operational entities correctly scoped by `organization_id` (except platform-wide: documents, document_categories, training_programs, training_modules).
- **Roles and superadmin**: `org_members.role` and `users.is_platform_superadmin` are present.
- **Project workflow**: Status values and project_claims are covered.
- **Quotes**: Versioning, items, and cost breakdown (factory, Vision Latam markup, partner markup, logistics, import, transport, technical_services) are present.
- **Engineering**: Requests, files, deliverables are covered.
- **Activity logs**: Entity type, entity id, action, metadata, organization, user are covered.

---

## 11. Conclusion

The ERD is **ready for implementation** with these adjustments:

1. Add FKs: `invited_by_user_id` (org_members), `approved_by_user_id` (project_claims).
2. Define enums for: org_members.status, quotes.status, quote_items.item_type, partner_profiles (partner_type, engineering_fee_mode), documents (visibility, optionally document_type).
3. Add optional user fields for NextAuth: email_verified, image.
4. Enforce uniqueness for quotes per org (e.g. organization_id + quote_number + version).
5. Add the recommended indexes for tenant and query performance.

The Prisma schema that reflects this ERD (with the above corrections) is in:

- **`packages/db/prisma/schema.partner-saas.prisma`** – target partner SaaS schema (validated with Prisma 5).

To adopt it as the main schema: copy it over `schema.prisma`, then run `pnpm db:generate` and create a new migration. The current `schema.prisma` contains the legacy single-tenant model; migration of existing data (if any) into the new tables is a separate step.

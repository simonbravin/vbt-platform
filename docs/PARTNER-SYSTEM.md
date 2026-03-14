# Partner Management System

Partner management, territories, onboarding, and org member management. Partners are organizations with type `commercial_partner` or `master_partner`. All partner/territory/onboarding operations require **platform superadmin**. Org members are scoped by **activeOrgId** (tenant).

---

## 1. Partner model

Partners correspond to **Organization** with `organizationType` in (`commercial_partner`, `master_partner`) and an associated **PartnerProfile**.

### Fields (API / display)

| Field | Source | Description |
|-------|--------|-------------|
| companyName | Organization.name | Company name |
| contactName | PartnerProfile.contactName | Primary contact name |
| contactEmail | PartnerProfile.contactEmail | Primary contact email |
| website | Organization.website | Website |
| country | Organization.countryCode | Country code |
| partnerType | PartnerProfile.partnerType | commercial_partner \| master_partner |
| engineeringFeeMode | PartnerProfile.engineeringFeeMode | fixed \| percent \| per_request \| included |
| status | Organization.status | active, suspended, etc. |

---

## 2. Partner API

| Method | Route | Description | Auth |
|--------|--------|-------------|------|
| GET | `/api/saas/partners` | List partners (query: status, partnerType, limit, offset) | Platform superadmin |
| POST | `/api/saas/partners` | Create partner (body: companyName, contactName?, contactEmail?, website?, country?, partnerType, engineeringFeeMode?, status?) | Platform superadmin |
| GET | `/api/saas/partners/[id]` | Get partner by id (with profile, territories) | Platform superadmin |
| PATCH | `/api/saas/partners/[id]` | Update partner (same fields as create, partial) | Platform superadmin |

**Activity log:** `partner_created` (POST), `partner_updated` (PATCH).

---

## 3. Territory system

Territories are stored in **PartnerTerritory**: `organizationId`, `countryCode`, `region`, `territoryType` (exclusive \| open \| referral). The API accepts `exclusive: true` and maps it to `territoryType: "exclusive"`.

### Endpoints

| Method | Route | Description | Auth |
|--------|--------|-------------|------|
| GET | `/api/saas/partners/[id]/territories` | List territories for partner | Platform superadmin |
| POST | `/api/saas/partners/[id]/territories` | Add territory (body: territoryType, countryCode, region?, exclusive?) | Platform superadmin |
| DELETE | `/api/saas/territories/[id]` | Remove territory by id | Platform superadmin |

**Activity log:** `territory_assigned` (POST), `territory_removed` (DELETE).

---

## 4. Partner onboarding

Onboarding state is stored on **PartnerProfile.onboardingState**.

### States

- application_received  
- agreement_signed  
- training_started  
- training_completed  
- active  

### Endpoints

| Method | Route | Description | Auth |
|--------|--------|-------------|------|
| GET | `/api/saas/partners/[id]/onboard` | Get current onboarding state | Platform superadmin |
| POST | `/api/saas/partners/[id]/onboard` | Set onboarding state (body: state) | Platform superadmin |
| PATCH | `/api/saas/partners/[id]/onboard` | Update onboarding state (body: state) | Platform superadmin |

**Activity log:** `partner_onboarded` (POST and PATCH when state is set).

---

## 5. Role management (org members)

Org members are **tenant-scoped** using **activeOrgId**. Only members of the active org can be listed, invited, updated, or removed.

### API roles (mapped to OrgMemberRole)

| API role | OrgMemberRole |
|----------|----------------|
| owner | org_admin |
| admin | org_admin |
| sales | sales_user |
| engineer | technical_user |
| viewer | viewer |

### Endpoints

| Method | Route | Description | Auth |
|--------|--------|-------------|------|
| GET | `/api/saas/org-members` | List members of active org (query: status, limit, offset) | Active org required |
| POST | `/api/saas/org-members` | Invite member (body: userId, role) | Active org required |
| PATCH | `/api/saas/org-members/[id]` | Update role or status | Active org required |
| DELETE | `/api/saas/org-members/[id]` | Remove member | Active org required |

**Activity log:** `member_invited` (POST), `member_role_changed` (PATCH when role changes).

---

## 6. Activity log events

| Action | When |
|--------|------|
| partner_created | POST /api/saas/partners |
| partner_updated | PATCH /api/saas/partners/[id] |
| territory_assigned | POST /api/saas/partners/[id]/territories |
| territory_removed | DELETE /api/saas/territories/[id] |
| partner_onboarded | POST/PATCH /api/saas/partners/[id]/onboard |
| member_invited | POST /api/saas/org-members |
| member_role_changed | PATCH /api/saas/org-members/[id] (role change) |

---

## 7. Tenant safety

- **Partners, territories, onboarding:** Only platform superadmin can call these APIs. No organizationId in request body for create/update; partner id is in the path.
- **Org members:** All operations are scoped by the caller’s **activeOrgId**. List/invite/update/remove only affect the active org. Require active org (or platform superadmin) for all org-member endpoints.

---

## 8. Remaining gaps

- No UI for partner list/detail, territories, onboarding, or org members; backend only.
- Invite flow: POST org-members with userId assumes the user already exists; no email-invite flow.
- Database migration required for new PartnerProfile fields: `contactName`, `contactEmail`, `onboardingState` (run `prisma migrate dev`).

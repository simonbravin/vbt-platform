# Training System

Platform-level programs; organization-scoped enrollments. Tracks progress and completion.

---

## 1. Architecture

- **Core service:** `packages/core/src/services/training.ts`
- **API routes:** `apps/web/src/app/api/saas/training/`
- **Programs:** Platform-wide (no organizationId). **Enrollments:** Scoped by `organizationId` (activeOrgId).

---

## 2. Training programs

- Stored in `TrainingProgram`: title, description, level, status, durationHours, modules.
- **Endpoints:** GET `/api/saas/training/programs` (optional query: status). No tenant filter.

---

## 3. Enrollments

- Stored in `TrainingEnrollment`: organizationId, userId, trainingProgramId, status, progressPct, startedAt, completedAt.
- **Unique:** (organizationId, userId, trainingProgramId).
- **Status:** `not_started` | `in_progress` | `completed`.
- **Progress:** `progressPct` (0–100). `completedAt` set when status becomes `completed` or via PATCH.

---

## 4. API Endpoints

| Method | Route | Description |
|--------|--------|-------------|
| GET    | `/api/saas/training/programs` | List programs (query: status). Platform-wide. |
| GET    | `/api/saas/training/enrollments` | List enrollments (query: userId, programId, status, limit, offset). Tenant-scoped. |
| POST   | `/api/saas/training/enrollments` | Enroll (body: programId, optional userId). Uses active org and current user if userId omitted. Logs `training_enrolled`. |
| PATCH  | `/api/saas/training/enrollments/[id]` | Update enrollment (body: progressPercent or progressPct, status, completedAt). Tenant-scoped. |

---

## 5. Tenant rules

- **Programs:** No organization filter; available to all.
- **Enrollments:** All list/create/update use `orgScopeWhere(ctx)`; only enrollments for the active org are visible/editable.

---

## 6. Activity Log

- **training_enrolled** — when a user is enrolled via POST (entityType: `training_enrollment`, entityId: enrollment id).

---

## 7. Remaining gaps

- No UI for programs or enrollments; backend only.
- Progress/completion can be updated via API; no in-app completion flow.
- Legacy routes (if any) under `/api/training` not replaced; prefer `/api/saas/training`.

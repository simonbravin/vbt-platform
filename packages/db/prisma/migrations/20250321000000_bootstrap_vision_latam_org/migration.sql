-- Bootstrap: ensure the platform-owner organization (Vision Latam) exists.
-- This is the single source of truth for "the company" that owns the platform and has its own stock/warehouses.
-- Idempotent: only inserts when no organization with type vision_latam exists (e.g. seed not run or DB new).
-- Same id as seed (seed-org-vision-latam) so seed upsert and this migration stay in sync.
INSERT INTO "organizations" (
  "id",
  "name",
  "legal_name",
  "organization_type",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  'seed-org-vision-latam',
  'Vision Latam',
  'Vision Latam SA',
  'vision_latam'::"OrganizationType",
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "organizations" WHERE "organization_type" = 'vision_latam'::"OrganizationType"
);

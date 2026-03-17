-- Single convention: every table that references organizations uses column "organization_id" (snake_case).
-- Normalize any legacy "orgId" or "organizationId" (camelCase) to organization_id.
-- Idempotent: safe to run multiple times. Tables: org_members, partner_profiles, partner_invites,
-- partner_territories, clients, projects, quotes, warehouses, engineering_requests, training_enrollments,
-- activity_logs, inventory_transactions, freight_profiles, tax_rule_sets.

DO $$
DECLARE
  tbl text;
  vl_id text;
  tables_with_org_fk text[] := ARRAY[
    'org_members', 'partner_profiles', 'partner_invites', 'partner_territories',
    'clients', 'projects', 'quotes', 'warehouses', 'engineering_requests',
    'training_enrollments', 'activity_logs', 'inventory_transactions',
    'freight_profiles', 'tax_rule_sets'
  ];
BEGIN
  SELECT id INTO vl_id FROM "organizations" WHERE organization_type = 'vision_latam' LIMIT 1;

  FOREACH tbl IN ARRAY tables_with_org_fk
  LOOP
    -- 1) Rename orgId -> organization_id (if orgId exists and organization_id does not)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'orgId')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id') THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN "orgId" TO organization_id', tbl);
    END IF;

    -- 2) Rename organizationId -> organization_id (if organizationId exists and organization_id does not)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organizationId')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id') THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN "organizationId" TO organization_id', tbl);
    END IF;

    -- 3) If both orgId and organization_id exist: backfill then drop orgId
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'orgId')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id') THEN
      EXECUTE format(
        'UPDATE %I w SET organization_id = COALESCE((SELECT o.id FROM organizations o WHERE o.id = w."orgId" LIMIT 1), $1) WHERE w.organization_id IS NULL',
        tbl
      ) USING vl_id;
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "orgId"', tbl);
    END IF;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN NULL; -- idempotent: ignore if column already correct or table missing
END $$;

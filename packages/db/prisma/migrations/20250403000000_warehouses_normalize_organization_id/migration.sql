-- Normalize warehouses.organization_id for Neon: Prisma expects organization_id (snake_case).
-- If the table has "orgId" (camelCase) from an old schema/db push, rename or sync and drop duplicate.

-- 1) Rename orgId to organization_id (if orgId exists and organization_id does not)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'orgId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE "warehouses" RENAME COLUMN "orgId" TO organization_id;
  END IF;
END $$;

-- 2) If both orgId and organization_id exist: backfill organization_id from orgId only where orgId exists in organizations; else set to vision_latam id; then drop orgId
DO $$
DECLARE
  vl_id TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'orgId'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'organization_id'
  ) THEN
    RETURN;
  END IF;
  SELECT id INTO vl_id FROM "organizations" WHERE organization_type = 'vision_latam' LIMIT 1;
  UPDATE "warehouses" w
  SET organization_id = COALESCE(
    (SELECT o.id FROM "organizations" o WHERE o.id = w."orgId" LIMIT 1),
    vl_id
  )
  WHERE w.organization_id IS NULL;
  ALTER TABLE "warehouses" DROP COLUMN "orgId";
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3) Ensure organization_id column exists (add if table existed without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE "warehouses" ADD COLUMN "organization_id" TEXT;
  END IF;
END $$;

-- 4) Backfill NULL organization_id from Vision Latam org if present; then SET NOT NULL only when no nulls remain
DO $$
DECLARE
  vl_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'organization_id') THEN
    RETURN;
  END IF;
  SELECT id INTO vl_id FROM "organizations" WHERE organization_type = 'vision_latam' LIMIT 1;
  IF vl_id IS NOT NULL THEN
    UPDATE "warehouses" SET organization_id = vl_id WHERE organization_id IS NULL;
  END IF;
  IF (SELECT COUNT(*) FROM "warehouses" WHERE organization_id IS NULL) = 0 THEN
    ALTER TABLE "warehouses" ALTER COLUMN organization_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5) Index and FK if missing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'warehouses' AND indexname = 'warehouses_organization_id_idx')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'organization_id') THEN
    CREATE INDEX "warehouses_organization_id_idx" ON "warehouses"("organization_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'warehouses' AND constraint_name = 'warehouses_organization_id_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'organization_id') THEN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

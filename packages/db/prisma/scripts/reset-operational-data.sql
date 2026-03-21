-- Reset operational / business data while preserving auth, orgs, partner config,
-- platform reference data (countries, tax_rule_sets, catalog, warehouses shell).
-- Run: pnpm --filter @vbt/db exec prisma db execute --file prisma/scripts/reset-operational-data.sql --schema prisma/schema.prisma
-- Then: pnpm --filter @vbt/db run db:rebuild-core-business
--   (ensure-quote-status-enum.sql + rebuild-core-business-tables.sql; avoids legacy clients/projects/quotes shape).

BEGIN;

TRUNCATE TABLE
  sale_invoices,
  payments,
  sales,
  quote_items,
  quotes,
  engineering_deliverables,
  engineering_files,
  documents,
  engineering_requests,
  project_claims,
  inventory_transactions,
  inventory_levels,
  projects,
  contacts,
  clients,
  training_enrollments,
  activity_logs
RESTART IDENTITY CASCADE;

DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;

COMMIT;

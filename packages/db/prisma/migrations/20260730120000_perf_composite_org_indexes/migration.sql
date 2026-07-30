-- Additive composite indexes for org-scoped list/order patterns (quotes, projects, sales, inventory tx).
-- Idempotent: IF NOT EXISTS. Non-CONCURRENT so Prisma migrate deploy can run in a transaction.
-- Safe on Neon pooled; no DROP / no data changes.

CREATE INDEX IF NOT EXISTS "quotes_organization_id_created_at_idx" ON "quotes"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "quotes_organization_id_status_idx" ON "quotes"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "projects_organization_id_created_at_idx" ON "projects"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "sales_organization_id_created_at_idx" ON "sales"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "sales_organization_id_status_idx" ON "sales"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "inventory_transactions_organization_id_created_at_idx" ON "inventory_transactions"("organization_id", "created_at");

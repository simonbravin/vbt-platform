-- Rebuild clients / contacts / projects / quotes / quote_items to match schema.prisma (snake_case, enums).
-- Preserves organizations, users, org_members, partner_*, countries, catalog, warehouses, sales shell, etc.
-- Requires enum types from Prisma migrations (ClientType, ProjectStatus, QuoteStatus, QuoteItemType).
-- Run after reset-operational-data.sql when operational tables are empty.
-- Usage (two steps; new enum labels must be committed before use in CREATE):
--   pnpm exec prisma db execute --file prisma/scripts/ensure-quote-status-enum.sql --schema prisma/schema.prisma
--   pnpm exec prisma db execute --file prisma/scripts/rebuild-core-business-tables.sql --schema prisma/schema.prisma

BEGIN;

DROP TABLE IF EXISTS "quote_items" CASCADE;
DROP TABLE IF EXISTS "quotes" CASCADE;
DROP TABLE IF EXISTS "contacts" CASCADE;
DROP TABLE IF EXISTS "clients" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;

CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_type" "ClientType" NOT NULL,
    "country_code" TEXT,
    "city" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "project_name" TEXT NOT NULL,
    "project_code" TEXT,
    "country_code" TEXT,
    "city" TEXT,
    "address" TEXT,
    "project_type" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'lead',
    "estimated_total_area_m2" DOUBLE PRECISION,
    "estimated_wall_area_m2" DOUBLE PRECISION,
    "estimated_units" INTEGER,
    "wall_height_m" DOUBLE PRECISION,
    "description" TEXT,
    "competition_notes" TEXT,
    "probability_pct" DOUBLE PRECISION,
    "expected_close_date" TIMESTAMP(3),
    "assigned_to_user_id" TEXT,
    "is_project_protected" BOOLEAN NOT NULL DEFAULT false,
    "project_protection_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "factory_cost_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vision_latam_markup_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partner_markup_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "logistics_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "import_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "local_transport_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "technical_service_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_rules_snapshot_json" JSONB,
    "valid_until" TIMESTAMP(3),
    "prepared_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "superadmin_comment" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "catalog_piece_id" TEXT,
    "item_type" "QuoteItemType" NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "markup_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clients_organization_id_idx" ON "clients"("organization_id");
CREATE INDEX "clients_client_type_idx" ON "clients"("client_type");
CREATE INDEX "contacts_client_id_idx" ON "contacts"("client_id");
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_assigned_to_user_id_idx" ON "projects"("assigned_to_user_id");
CREATE INDEX "quotes_organization_id_idx" ON "quotes"("organization_id");
CREATE INDEX "quotes_project_id_idx" ON "quotes"("project_id");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");
CREATE INDEX "quotes_created_at_idx" ON "quotes"("created_at");
CREATE UNIQUE INDEX "quotes_organization_id_quote_number_version_key" ON "quotes"("organization_id", "quote_number", "version");
CREATE INDEX "quote_items_quote_id_idx" ON "quote_items"("quote_id");
CREATE INDEX "quote_items_catalog_piece_id_idx" ON "quote_items"("catalog_piece_id");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_prepared_by_user_id_fkey" FOREIGN KEY ("prepared_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quote_items"
  ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_items"
  ADD CONSTRAINT "quote_items_catalog_piece_id_fkey" FOREIGN KEY ("catalog_piece_id") REFERENCES "catalog_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_claims"
  ADD CONSTRAINT "project_claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engineering_requests"
  ADD CONSTRAINT "engineering_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_reference_project_id_fkey" FOREIGN KEY ("reference_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_reference_quote_id_fkey" FOREIGN KEY ("reference_quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

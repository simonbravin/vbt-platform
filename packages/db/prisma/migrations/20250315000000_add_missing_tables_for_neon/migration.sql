-- Add all tables and enums required by Prisma schema that may be missing in Neon.
-- Idempotent: safe to run when tables/enums already exist (CREATE IF NOT EXISTS / DO with EXCEPTION).

-- Enums (skip if already exist)
DO $$ BEGIN CREATE TYPE "OrganizationType" AS ENUM ('vision_latam', 'commercial_partner', 'master_partner', 'internal'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrgMemberRole" AS ENUM ('org_admin', 'sales_user', 'technical_user', 'viewer'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrgMemberStatus" AS ENUM ('active', 'inactive', 'invited', 'suspended'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PartnerType" AS ENUM ('commercial_partner', 'master_partner'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TerritoryType" AS ENUM ('exclusive', 'open', 'referral'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ClientType" AS ENUM ('developer', 'builder', 'architect', 'government', 'end_client'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ProjectStatus" AS ENUM ('lead', 'qualified', 'quoting', 'engineering', 'won', 'lost', 'on_hold'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ProjectClaimStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "QuoteItemType" AS ENUM ('product', 'service', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EngineeringRequestStatus" AS ENUM ('draft', 'submitted', 'in_review', 'pending_info', 'needs_info', 'in_progress', 'completed', 'delivered', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DocumentVisibility" AS ENUM ('public', 'partners_only', 'internal'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EngineeringFeeMode" AS ENUM ('fixed', 'percent', 'per_request', 'included'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('not_started', 'in_progress', 'completed'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tables (only if not exist)
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "organization_type" "OrganizationType" NOT NULL,
    "country_code" TEXT,
    "tax_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "org_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'viewer',
    "status" "OrgMemberStatus" NOT NULL DEFAULT 'active',
    "invited_by_user_id" TEXT,
    "joined_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "partner_type" "PartnerType" NOT NULL,
    "territory_mode" TEXT,
    "onboarding_state" TEXT,
    "entry_fee_usd" DOUBLE PRECISION,
    "training_fee_usd" DOUBLE PRECISION,
    "material_credit_usd" DOUBLE PRECISION,
    "engineering_fee_mode" "EngineeringFeeMode",
    "engineering_fee_value" DOUBLE PRECISION,
    "margin_min_pct" DOUBLE PRECISION,
    "margin_max_pct" DOUBLE PRECISION,
    "minimum_price_policy" TEXT,
    "sales_target_annual_usd" DOUBLE PRECISION,
    "sales_target_annual_m2" DOUBLE PRECISION,
    "agreement_start_date" TIMESTAMP(3),
    "agreement_end_date" TIMESTAMP(3),
    "agreement_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_territories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "territory_type" "TerritoryType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_territories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clients" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "projects" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_claims" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "claiming_organization_id" TEXT NOT NULL,
    "status" "ProjectClaimStatus" NOT NULL DEFAULT 'pending',
    "approved_by_user_id" TEXT,
    "claim_start_date" TIMESTAMP(3),
    "claim_end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quotes" (
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
    "valid_until" TIMESTAMP(3),
    "prepared_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "engineering_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "status" "EngineeringRequestStatus" NOT NULL DEFAULT 'submitted',
    "requested_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "request_type" TEXT,
    "wall_area_m2" DOUBLE PRECISION,
    "system_type" TEXT,
    "target_delivery_date" TIMESTAMP(3),
    "engineering_fee_value" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "engineering_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "engineering_files" (
    "id" TEXT NOT NULL,
    "engineering_request_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "engineering_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "engineering_deliverables" (
    "id" TEXT NOT NULL,
    "engineering_request_id" TEXT NOT NULL,
    "deliverable_type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "engineering_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "document_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "documents" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "document_type" TEXT,
    "file_url" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "language_code" TEXT,
    "country_scope" TEXT,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'partners_only',
    "published_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_programs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "duration_hours" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_modules" (
    "id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "module_type" TEXT,
    "content_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_enrollments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'not_started',
    "progress_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes (idempotent; ignore errors if table has legacy column names)
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "partner_profiles_organization_id_key" ON "partner_profiles"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "partner_invites_token_key" ON "partner_invites"("token"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "partner_invites_organization_id_idx" ON "partner_invites"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "partner_invites_email_idx" ON "partner_invites"("email"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "partner_invites_token_idx" ON "partner_invites"("token"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "organizations_organization_type_idx" ON "organizations"("organization_type"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "org_members_user_id_idx" ON "org_members"("user_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "org_members_organization_id_idx" ON "org_members"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "org_members_organization_id_user_id_key" ON "org_members"("organization_id", "user_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "partner_territories_organization_id_idx" ON "partner_territories"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "partner_territories_country_code_idx" ON "partner_territories"("country_code"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "clients_organization_id_idx" ON "clients"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "clients_client_type_idx" ON "clients"("client_type"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "contacts_client_id_idx" ON "contacts"("client_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "projects_organization_id_idx" ON "projects"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "projects_client_id_idx" ON "projects"("client_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "projects_assigned_to_user_id_idx" ON "projects"("assigned_to_user_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "project_claims_project_id_idx" ON "project_claims"("project_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "project_claims_claiming_organization_id_idx" ON "project_claims"("claiming_organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "project_claims_status_idx" ON "project_claims"("status"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "quotes_organization_id_idx" ON "quotes"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "quotes_project_id_idx" ON "quotes"("project_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes"("status"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "quotes_created_at_idx" ON "quotes"("created_at"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "quotes_organization_id_quote_number_version_key" ON "quotes"("organization_id", "quote_number", "version"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "quote_items_quote_id_idx" ON "quote_items"("quote_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "engineering_requests_organization_id_idx" ON "engineering_requests"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "engineering_requests_project_id_idx" ON "engineering_requests"("project_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "engineering_requests_status_idx" ON "engineering_requests"("status"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "engineering_files_engineering_request_id_idx" ON "engineering_files"("engineering_request_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "engineering_deliverables_engineering_request_id_idx" ON "engineering_deliverables"("engineering_request_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "document_categories_code_key" ON "document_categories"("code"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "documents_category_id_idx" ON "documents"("category_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "documents_visibility_idx" ON "documents"("visibility"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "documents_country_scope_idx" ON "documents"("country_scope"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "training_modules_training_program_id_idx" ON "training_modules"("training_program_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "training_enrollments_organization_id_idx" ON "training_enrollments"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "training_enrollments_user_id_idx" ON "training_enrollments"("user_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "training_enrollments_training_program_id_idx" ON "training_enrollments"("training_program_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "training_enrollments_organization_id_user_id_training_progr_key" ON "training_enrollments"("organization_id", "user_id", "training_program_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "activity_logs_organization_id_idx" ON "activity_logs"("organization_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs"("user_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "activity_logs_entity_type_idx" ON "activity_logs"("entity_type"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "activity_logs_entity_id_idx" ON "activity_logs"("entity_id"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs"("created_at"); EXCEPTION WHEN OTHERS THEN null; END $$;

-- Foreign keys (ignore if already exist or table has legacy columns)
DO $$ BEGIN ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "org_members" ADD CONSTRAINT "org_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "partner_territories" ADD CONSTRAINT "partner_territories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "project_claims" ADD CONSTRAINT "project_claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "project_claims" ADD CONSTRAINT "project_claims_claiming_organization_id_fkey" FOREIGN KEY ("claiming_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "project_claims" ADD CONSTRAINT "project_claims_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_prepared_by_user_id_fkey" FOREIGN KEY ("prepared_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_requests" ADD CONSTRAINT "engineering_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_requests" ADD CONSTRAINT "engineering_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_requests" ADD CONSTRAINT "engineering_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_requests" ADD CONSTRAINT "engineering_requests_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_files" ADD CONSTRAINT "engineering_files_engineering_request_id_fkey" FOREIGN KEY ("engineering_request_id") REFERENCES "engineering_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_files" ADD CONSTRAINT "engineering_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_deliverables" ADD CONSTRAINT "engineering_deliverables_engineering_request_id_fkey" FOREIGN KEY ("engineering_request_id") REFERENCES "engineering_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "engineering_deliverables" ADD CONSTRAINT "engineering_deliverables_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_training_program_id_fkey" FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_training_program_id_fkey" FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN OTHERS THEN null; END $$;

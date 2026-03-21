-- Partner allowlist for platform document library rows (documents.organization_id IS NULL).

CREATE TABLE IF NOT EXISTS "document_allowed_organizations" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_allowed_organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_allowed_organizations_document_id_organization_id_key"
    ON "document_allowed_organizations"("document_id", "organization_id");

CREATE INDEX IF NOT EXISTS "document_allowed_organizations_organization_id_idx"
    ON "document_allowed_organizations"("organization_id");

DO $$ BEGIN
  ALTER TABLE "document_allowed_organizations"
    ADD CONSTRAINT "document_allowed_organizations_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_allowed_organizations"
    ADD CONSTRAINT "document_allowed_organizations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

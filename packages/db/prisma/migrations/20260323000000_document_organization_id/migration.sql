-- AlterTable: add organization_id to documents for partner-scoped access (null = platform doc).
ALTER TABLE "documents" ADD COLUMN "organization_id" TEXT;

CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

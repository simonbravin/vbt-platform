-- AlterTable: add optional project and engineering request links to documents (for engineering file listing in Documentos).
ALTER TABLE "documents" ADD COLUMN "project_id" TEXT;
ALTER TABLE "documents" ADD COLUMN "engineering_request_id" TEXT;

CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");
CREATE INDEX "documents_engineering_request_id_idx" ON "documents"("engineering_request_id");

ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_engineering_request_id_fkey" FOREIGN KEY ("engineering_request_id") REFERENCES "engineering_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

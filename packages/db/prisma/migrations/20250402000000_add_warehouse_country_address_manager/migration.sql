-- AlterTable: add country_code, address, manager_name to warehouses
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "country_code" TEXT;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "manager_name" TEXT;

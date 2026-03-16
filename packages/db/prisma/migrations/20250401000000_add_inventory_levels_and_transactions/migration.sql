-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('purchase_in', 'sale_out', 'project_consumption', 'project_surplus', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out');

-- CreateTable
CREATE TABLE "inventory_levels" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "catalog_piece_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "catalog_piece_id" TEXT NOT NULL,
    "quantity_delta" DOUBLE PRECISION NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "reference_quote_id" TEXT,
    "reference_project_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- Add catalog_piece_id to quote_items
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "catalog_piece_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "inventory_levels_warehouse_id_catalog_piece_id_key" ON "inventory_levels"("warehouse_id", "catalog_piece_id");

-- CreateIndex
CREATE INDEX "inventory_levels_warehouse_id_idx" ON "inventory_levels"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_levels_catalog_piece_id_idx" ON "inventory_levels"("catalog_piece_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_warehouse_id_idx" ON "inventory_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_catalog_piece_id_idx" ON "inventory_transactions"("catalog_piece_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_quote_id_idx" ON "inventory_transactions"("reference_quote_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_project_id_idx" ON "inventory_transactions"("reference_project_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_organization_id_idx" ON "inventory_transactions"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions"("created_at");

-- CreateIndex
CREATE INDEX "quote_items_catalog_piece_id_idx" ON "quote_items"("catalog_piece_id");

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_catalog_piece_id_fkey" FOREIGN KEY ("catalog_piece_id") REFERENCES "catalog_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_catalog_piece_id_fkey" FOREIGN KEY ("catalog_piece_id") REFERENCES "catalog_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_reference_quote_id_fkey" FOREIGN KEY ("reference_quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_reference_project_id_fkey" FOREIGN KEY ("reference_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (quote_items.catalog_piece_id)
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_catalog_piece_id_fkey" FOREIGN KEY ("catalog_piece_id") REFERENCES "catalog_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

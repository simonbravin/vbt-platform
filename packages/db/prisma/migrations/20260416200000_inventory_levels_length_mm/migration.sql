-- Stock buckets per warehouse + catalog piece + length (mm). 0 = undifferentiated / legacy aggregate.

ALTER TABLE "inventory_levels" ADD COLUMN "length_mm" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "inventory_levels_warehouse_id_catalog_piece_id_key";

CREATE UNIQUE INDEX "inventory_levels_warehouse_id_catalog_piece_id_length_mm_key" ON "inventory_levels"("warehouse_id", "catalog_piece_id", "length_mm");

CREATE INDEX "inventory_levels_length_mm_idx" ON "inventory_levels"("length_mm");

ALTER TABLE "inventory_transactions" ADD COLUMN "length_mm" INTEGER NOT NULL DEFAULT 0;

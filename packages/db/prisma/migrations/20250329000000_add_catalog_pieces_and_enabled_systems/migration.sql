-- Piece catalog: platform-wide; superadmin loads; partners see only pieces for their enabled systems.
CREATE TABLE IF NOT EXISTS "catalog_pieces" (
    "id" TEXT NOT NULL,
    "die_number" TEXT,
    "canonical_name" TEXT NOT NULL,
    "system_code" TEXT NOT NULL,
    "useful_width_mm" DOUBLE PRECISION,
    "lbs_per_m_cored" DOUBLE PRECISION,
    "price_per_m_cored" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_pieces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_pieces_canonical_name_system_code_key" ON "catalog_pieces"("canonical_name", "system_code");
CREATE INDEX IF NOT EXISTS "catalog_pieces_system_code_idx" ON "catalog_pieces"("system_code");
CREATE INDEX IF NOT EXISTS "catalog_pieces_is_active_idx" ON "catalog_pieces"("is_active");

-- Per-partner enabled panel systems (S80, S150, S200); null = all enabled.
ALTER TABLE "partner_profiles" ADD COLUMN IF NOT EXISTS "enabled_systems" JSONB;

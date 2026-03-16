-- CreateTable: countries (platform-wide; only superadmin can add/edit)
CREATE TABLE IF NOT EXISTS "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "countries_code_key" ON "countries"("code");

-- CreateTable: freight_profiles (organization_id null = Vision Latam base; set = partner override)
CREATE TABLE IF NOT EXISTS "freight_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "freight_per_container" DOUBLE PRECISION NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "expiry_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freight_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "freight_profiles_organization_id_idx" ON "freight_profiles"("organization_id");
CREATE INDEX IF NOT EXISTS "freight_profiles_country_id_idx" ON "freight_profiles"("country_id");

ALTER TABLE "freight_profiles" ADD CONSTRAINT "freight_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freight_profiles" ADD CONSTRAINT "freight_profiles_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: tax_rule_sets (organization_id null = base; set = partner override)
CREATE TABLE IF NOT EXISTS "tax_rule_sets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "rules_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rule_sets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_rule_sets_organization_id_idx" ON "tax_rule_sets"("organization_id");
CREATE INDEX IF NOT EXISTS "tax_rule_sets_country_id_idx" ON "tax_rule_sets"("country_id");

ALTER TABLE "tax_rule_sets" ADD CONSTRAINT "tax_rule_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_rule_sets" ADD CONSTRAINT "tax_rule_sets_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

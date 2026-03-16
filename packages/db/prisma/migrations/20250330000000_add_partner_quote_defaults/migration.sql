-- Partner-level quote defaults (minRunFt, commissionPct, commissionFixed, baseUom, weightUom)
ALTER TABLE "partner_profiles" ADD COLUMN IF NOT EXISTS "quote_defaults" JSONB;

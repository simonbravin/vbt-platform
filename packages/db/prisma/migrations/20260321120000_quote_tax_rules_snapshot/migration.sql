-- Persist SaaS quote tax rules at pricing-write time (single financial truth vs. live TaxRuleSet edits).
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax_rules_snapshot_json" JSONB;

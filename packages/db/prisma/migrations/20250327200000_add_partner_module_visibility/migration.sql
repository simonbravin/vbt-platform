-- Add module_visibility to partner_profiles for per-partner override of global module visibility.
ALTER TABLE "partner_profiles" ADD COLUMN IF NOT EXISTS "module_visibility" JSONB;

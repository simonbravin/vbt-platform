-- Platform-level tax rule set for Honduras (HN): empty rules array allows quote wizard preview/create;
-- superadmin can add real tax lines later via Superadmin → Impuestos.
INSERT INTO "tax_rule_sets" ("id", "organization_id", "name", "country_id", "rules_json", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  NULL,
  'Honduras (platform default)',
  c."id",
  '[]'::jsonb,
  NOW(),
  NOW()
FROM "countries" c
WHERE c."code" = 'HN'
  AND NOT EXISTS (
    SELECT 1 FROM "tax_rule_sets" t
    WHERE t."country_id" = c."id" AND t."organization_id" IS NULL
  );

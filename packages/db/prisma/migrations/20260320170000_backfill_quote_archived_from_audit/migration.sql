-- Some Neon DBs were created before all QuoteStatus values existed; ensure comparison literals are valid.
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'rejected';

-- Reclassify quotes stored as rejected when audit explicitly recorded an archive.
UPDATE "quotes" AS q
SET "status" = 'archived'::"QuoteStatus"
WHERE q."status"::text = 'rejected'
  AND EXISTS (
    SELECT 1
    FROM "activity_logs" AS a
    WHERE a."entity_id" = q."id"
      AND a."action" = 'QUOTE_ARCHIVED'
      AND a."entity_type" IN ('Quote', 'quote')
  );

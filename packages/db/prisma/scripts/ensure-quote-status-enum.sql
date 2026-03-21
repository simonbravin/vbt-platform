-- QuoteStatus must include Prisma literals. Run alone (separate transaction) before rebuild-core-business-tables.sql.
-- See: https://www.postgresql.org/docs/current/sql-altertype.html (new enum values must be committed before use)
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'expired';

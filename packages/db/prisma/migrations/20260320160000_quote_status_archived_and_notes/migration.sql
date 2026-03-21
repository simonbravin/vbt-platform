-- Quote lifecycle: distinct archived state (not rejected). Partner/internal notes column.

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'archived';

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "notes" TEXT;

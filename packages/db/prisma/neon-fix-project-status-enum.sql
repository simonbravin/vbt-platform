-- Add new ProjectStatus enum values if missing (Prisma schema: DRAFT, QUOTED, QUOTE_SENT, SOLD, ARCHIVED).
-- Then migrate IN_CONVERSATION -> QUOTE_SENT.
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'QUOTE_SENT';
UPDATE projects SET status = 'QUOTE_SENT' WHERE status = 'IN_CONVERSATION';

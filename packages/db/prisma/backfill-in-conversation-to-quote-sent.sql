-- One-off: migrate projects from old enum value IN_CONVERSATION to QUOTE_SENT.
-- Run in production DB (e.g. Neon SQL Editor) after ProjectStatus enum has been updated.
-- Table name is "projects" (Prisma @@map).
UPDATE projects SET status = 'QUOTE_SENT' WHERE status = 'IN_CONVERSATION';

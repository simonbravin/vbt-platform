-- Ensure users.created_at exists (Prisma createdAt)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

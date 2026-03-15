-- Ensure users.updated_at has DEFAULT so INSERT without explicit value works (Neon/Prisma).
-- Idempotent: safe when default already exists.
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

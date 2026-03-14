-- Align `users` table with Prisma schema (full_name, password_hash, and optional columns).
-- Idempotent: safe to run multiple times. Use when Neon (or other DB) was created with
-- different column names (e.g. "name" instead of "full_name", or "passwordHash" instead of "password_hash").

-- 1) full_name: rename "name" to "full_name" if needed, or add full_name if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
    ) THEN
      ALTER TABLE users RENAME COLUMN name TO full_name;
    ELSE
      ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT 'User';
      UPDATE users SET full_name = COALESCE(email, id::text) WHERE full_name = 'User';
      ALTER TABLE users ALTER COLUMN full_name DROP DEFAULT;
    END IF;
  END IF;
END $$;

-- 2) password_hash: rename "passwordHash" (camelCase) to password_hash if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'passwordHash'
    ) THEN
      ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash;
    ELSE
      -- Column missing entirely: add; run seed or check-users to set passwords for existing users
      ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
      ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;
    END IF;
  END IF;
END $$;

-- 3) Optional columns per Prisma schema (add if missing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_superadmin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP(3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP(3);

-- 4) Ensure updated_at exists (Prisma @updatedAt)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Solución definitiva: tabla users con created_at y updated_at en snake_case y con DEFAULT.
-- Así cualquier INSERT (Prisma o raw) que omita estas columnas no falla, y el código puede usar siempre los nombres del schema (@map).

-- 1) Normalizar nombres a snake_case (por si la tabla tiene createdAt/updatedAt en camelCase)
DO $$
BEGIN
  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updatedAt'
    ) THEN
      ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
    ELSE
      ALTER TABLE users ADD COLUMN updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'createdAt'
    ) THEN
      ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
    ELSE
      ALTER TABLE users ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END IF;
END $$;

-- 2) Garantizar DEFAULT en ambas columnas (idempotente)
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

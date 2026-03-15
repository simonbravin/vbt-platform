-- Asegurar que el enum OrgMemberRole tenga los valores que usa Prisma (org_admin, sales_user, technical_user, viewer).
-- En Neon el enum puede tener solo SUPERADMIN/ADMIN; sin estos valores el upsert en accept-invite falla con 22P02.
-- Nota: en PostgreSQL los nuevos valores de enum no se pueden usar en la misma transacción; los UPDATE van en la migración siguiente.
DO $$ BEGIN ALTER TYPE "OrgMemberRole" ADD VALUE 'org_admin';   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "OrgMemberRole" ADD VALUE 'sales_user';   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "OrgMemberRole" ADD VALUE 'technical_user'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "OrgMemberRole" ADD VALUE 'viewer';      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
CREATE TYPE "EmailLocale" AS ENUM ('en', 'es');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_locale" "EmailLocale" NOT NULL DEFAULT 'en';

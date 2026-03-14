-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

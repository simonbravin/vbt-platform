-- CreateEnum
CREATE TYPE "EngineeringReviewVisibility" AS ENUM ('partner', 'internal');

-- CreateTable
CREATE TABLE "engineering_review_events" (
    "id" TEXT NOT NULL,
    "engineering_request_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "visibility" "EngineeringReviewVisibility" NOT NULL DEFAULT 'partner',
    "body" TEXT NOT NULL,
    "from_status" "EngineeringRequestStatus",
    "to_status" "EngineeringRequestStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engineering_review_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engineering_review_events_engineering_request_id_idx" ON "engineering_review_events"("engineering_request_id");

-- CreateIndex
CREATE INDEX "engineering_review_events_engineering_request_id_created_at_idx" ON "engineering_review_events"("engineering_request_id", "created_at");

-- AddForeignKey
ALTER TABLE "engineering_review_events" ADD CONSTRAINT "engineering_review_events_engineering_request_id_fkey" FOREIGN KEY ("engineering_request_id") REFERENCES "engineering_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineering_review_events" ADD CONSTRAINT "engineering_review_events_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN "require_delivered_engineering_for_quotes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "engineering_request_id" TEXT;

-- CreateIndex
CREATE INDEX "quotes_engineering_request_id_idx" ON "quotes"("engineering_request_id");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_engineering_request_id_fkey" FOREIGN KEY ("engineering_request_id") REFERENCES "engineering_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

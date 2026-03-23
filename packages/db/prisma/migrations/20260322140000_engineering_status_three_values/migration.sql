-- Simplify EngineeringRequestStatus to draft | in_review | completed.
-- Map legacy values before swapping the enum type.

CREATE TYPE "EngineeringRequestStatus_new" AS ENUM ('draft', 'in_review', 'completed');

-- Drop default that references old enum
ALTER TABLE "engineering_requests" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "engineering_requests" ALTER COLUMN "status" TYPE "EngineeringRequestStatus_new" USING (
  CASE "status"::text
    WHEN 'draft' THEN 'draft'::"EngineeringRequestStatus_new"
    WHEN 'in_review' THEN 'in_review'::"EngineeringRequestStatus_new"
    WHEN 'submitted' THEN 'in_review'::"EngineeringRequestStatus_new"
    WHEN 'pending_info' THEN 'in_review'::"EngineeringRequestStatus_new"
    WHEN 'needs_info' THEN 'in_review'::"EngineeringRequestStatus_new"
    WHEN 'in_progress' THEN 'in_review'::"EngineeringRequestStatus_new"
    WHEN 'completed' THEN 'completed'::"EngineeringRequestStatus_new"
    WHEN 'delivered' THEN 'completed'::"EngineeringRequestStatus_new"
    WHEN 'rejected' THEN 'completed'::"EngineeringRequestStatus_new"
    ELSE 'in_review'::"EngineeringRequestStatus_new"
  END
);

ALTER TABLE "engineering_review_events" ALTER COLUMN "from_status" TYPE "EngineeringRequestStatus_new" USING (
  CASE
    WHEN "from_status" IS NULL THEN NULL
    ELSE CASE "from_status"::text
      WHEN 'draft' THEN 'draft'::"EngineeringRequestStatus_new"
      WHEN 'in_review' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'submitted' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'pending_info' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'needs_info' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'in_progress' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'completed' THEN 'completed'::"EngineeringRequestStatus_new"
      WHEN 'delivered' THEN 'completed'::"EngineeringRequestStatus_new"
      WHEN 'rejected' THEN 'completed'::"EngineeringRequestStatus_new"
      ELSE 'in_review'::"EngineeringRequestStatus_new"
    END
  END
);

ALTER TABLE "engineering_review_events" ALTER COLUMN "to_status" TYPE "EngineeringRequestStatus_new" USING (
  CASE
    WHEN "to_status" IS NULL THEN NULL
    ELSE CASE "to_status"::text
      WHEN 'draft' THEN 'draft'::"EngineeringRequestStatus_new"
      WHEN 'in_review' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'submitted' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'pending_info' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'needs_info' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'in_progress' THEN 'in_review'::"EngineeringRequestStatus_new"
      WHEN 'completed' THEN 'completed'::"EngineeringRequestStatus_new"
      WHEN 'delivered' THEN 'completed'::"EngineeringRequestStatus_new"
      WHEN 'rejected' THEN 'completed'::"EngineeringRequestStatus_new"
      ELSE 'in_review'::"EngineeringRequestStatus_new"
    END
  END
);

DROP TYPE "EngineeringRequestStatus";

ALTER TYPE "EngineeringRequestStatus_new" RENAME TO "EngineeringRequestStatus";

ALTER TABLE "engineering_requests" ALTER COLUMN "status" SET DEFAULT 'draft'::"EngineeringRequestStatus";

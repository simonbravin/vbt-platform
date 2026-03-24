-- Training: program visibility, live sessions, session enrollments, quizzes, certificates.

CREATE TYPE "TrainingProgramVisibility" AS ENUM ('all_partners', 'selected_partners');
CREATE TYPE "TrainingLiveSessionStatus" AS ENUM ('scheduled', 'cancelled', 'completed');
CREATE TYPE "TrainingSessionEnrollmentStatus" AS ENUM ('registered', 'cancelled', 'attended', 'no_show');
CREATE TYPE "QuizQuestionStatus" AS ENUM ('draft', 'published');
CREATE TYPE "QuizDefinitionStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "TrainingCertificateType" AS ENUM ('live_session', 'quiz');

ALTER TABLE "training_programs" ADD COLUMN "visibility" "TrainingProgramVisibility" NOT NULL DEFAULT 'all_partners';
ALTER TABLE "training_programs" ADD COLUMN "published_at" TIMESTAMP(3);
CREATE INDEX "training_programs_visibility_idx" ON "training_programs"("visibility");
CREATE INDEX "training_programs_published_at_idx" ON "training_programs"("published_at");

CREATE TABLE "training_program_allowed_organizations" (
    "id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_program_allowed_organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_program_allowed_organizations_training_program_id_organization_id_key"
    ON "training_program_allowed_organizations"("training_program_id", "organization_id");
CREATE INDEX "training_program_allowed_organizations_organization_id_idx"
    ON "training_program_allowed_organizations"("organization_id");
ALTER TABLE "training_program_allowed_organizations"
    ADD CONSTRAINT "training_program_allowed_organizations_training_program_id_fkey"
    FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_program_allowed_organizations"
    ADD CONSTRAINT "training_program_allowed_organizations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_live_sessions" (
    "id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "meeting_url" TEXT,
    "status" "TrainingLiveSessionStatus" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_live_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_live_sessions_training_program_id_idx" ON "training_live_sessions"("training_program_id");
CREATE INDEX "training_live_sessions_starts_at_idx" ON "training_live_sessions"("starts_at");
ALTER TABLE "training_live_sessions"
    ADD CONSTRAINT "training_live_sessions_training_program_id_fkey"
    FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_session_enrollments" (
    "id" TEXT NOT NULL,
    "live_session_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "TrainingSessionEnrollmentStatus" NOT NULL DEFAULT 'registered',
    "attendance_marked_at" TIMESTAMP(3),
    "attendance_marked_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_session_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_session_enrollments_organization_id_user_id_live_session_id_key"
    ON "training_session_enrollments"("organization_id", "user_id", "live_session_id");
CREATE INDEX "training_session_enrollments_live_session_id_idx" ON "training_session_enrollments"("live_session_id");
CREATE INDEX "training_session_enrollments_organization_id_idx" ON "training_session_enrollments"("organization_id");
CREATE INDEX "training_session_enrollments_user_id_idx" ON "training_session_enrollments"("user_id");
ALTER TABLE "training_session_enrollments"
    ADD CONSTRAINT "training_session_enrollments_live_session_id_fkey"
    FOREIGN KEY ("live_session_id") REFERENCES "training_live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_session_enrollments"
    ADD CONSTRAINT "training_session_enrollments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_session_enrollments"
    ADD CONSTRAINT "training_session_enrollments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_session_enrollments"
    ADD CONSTRAINT "training_session_enrollments_attendance_marked_by_user_id_fkey"
    FOREIGN KEY ("attendance_marked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "quiz_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quiz_topics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quiz_topics_code_key" ON "quiz_topics"("code");

CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "status" "QuizQuestionStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quiz_questions_topic_id_idx" ON "quiz_questions"("topic_id");
CREATE INDEX "quiz_questions_status_idx" ON "quiz_questions"("status");
ALTER TABLE "quiz_questions"
    ADD CONSTRAINT "quiz_questions_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "quiz_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quiz_question_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quiz_question_options_question_id_idx" ON "quiz_question_options"("question_id");
ALTER TABLE "quiz_question_options"
    ADD CONSTRAINT "quiz_question_options_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_definitions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passing_score_pct" DOUBLE PRECISION NOT NULL,
    "status" "QuizDefinitionStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "visibility" "TrainingProgramVisibility" NOT NULL DEFAULT 'all_partners',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quiz_definitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quiz_definitions_status_idx" ON "quiz_definitions"("status");
CREATE INDEX "quiz_definitions_visibility_idx" ON "quiz_definitions"("visibility");

CREATE TABLE "quiz_definition_topic_rules" (
    "id" TEXT NOT NULL,
    "quiz_definition_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "pick_count" INTEGER NOT NULL,
    CONSTRAINT "quiz_definition_topic_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quiz_definition_topic_rules_quiz_definition_id_topic_id_key"
    ON "quiz_definition_topic_rules"("quiz_definition_id", "topic_id");
CREATE INDEX "quiz_definition_topic_rules_topic_id_idx" ON "quiz_definition_topic_rules"("topic_id");
ALTER TABLE "quiz_definition_topic_rules"
    ADD CONSTRAINT "quiz_definition_topic_rules_quiz_definition_id_fkey"
    FOREIGN KEY ("quiz_definition_id") REFERENCES "quiz_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_definition_topic_rules"
    ADD CONSTRAINT "quiz_definition_topic_rules_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "quiz_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_allowed_organizations" (
    "id" TEXT NOT NULL,
    "quiz_definition_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_allowed_organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quiz_allowed_organizations_quiz_definition_id_organization_id_key"
    ON "quiz_allowed_organizations"("quiz_definition_id", "organization_id");
CREATE INDEX "quiz_allowed_organizations_organization_id_idx" ON "quiz_allowed_organizations"("organization_id");
ALTER TABLE "quiz_allowed_organizations"
    ADD CONSTRAINT "quiz_allowed_organizations_quiz_definition_id_fkey"
    FOREIGN KEY ("quiz_definition_id") REFERENCES "quiz_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_allowed_organizations"
    ADD CONSTRAINT "quiz_allowed_organizations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "quiz_definition_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "score_pct" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "random_seed" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quiz_attempts_quiz_definition_id_idx" ON "quiz_attempts"("quiz_definition_id");
CREATE INDEX "quiz_attempts_organization_id_idx" ON "quiz_attempts"("organization_id");
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts"("user_id");
CREATE INDEX "quiz_attempts_submitted_at_idx" ON "quiz_attempts"("submitted_at");
ALTER TABLE "quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_quiz_definition_id_fkey"
    FOREIGN KEY ("quiz_definition_id") REFERENCES "quiz_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_attempt_answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "selected_option_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quiz_attempt_answers_attempt_id_question_key_key"
    ON "quiz_attempt_answers"("attempt_id", "question_key");
CREATE INDEX "quiz_attempt_answers_attempt_id_idx" ON "quiz_attempt_answers"("attempt_id");
ALTER TABLE "quiz_attempt_answers"
    ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_certificates" (
    "id" TEXT NOT NULL,
    "type" "TrainingCertificateType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "live_session_id" TEXT,
    "quiz_attempt_id" TEXT,
    "title_snapshot" TEXT NOT NULL,
    "participant_name_snapshot" TEXT NOT NULL,
    "org_name_snapshot" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,
    "pdf_url" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_certificates_quiz_attempt_id_key" ON "training_certificates"("quiz_attempt_id");
CREATE UNIQUE INDEX "training_certificates_dedupe_key_key" ON "training_certificates"("dedupe_key");
CREATE INDEX "training_certificates_user_id_idx" ON "training_certificates"("user_id");
CREATE INDEX "training_certificates_organization_id_idx" ON "training_certificates"("organization_id");
CREATE INDEX "training_certificates_live_session_id_idx" ON "training_certificates"("live_session_id");
ALTER TABLE "training_certificates"
    ADD CONSTRAINT "training_certificates_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_certificates"
    ADD CONSTRAINT "training_certificates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_certificates"
    ADD CONSTRAINT "training_certificates_live_session_id_fkey"
    FOREIGN KEY ("live_session_id") REFERENCES "training_live_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_certificates"
    ADD CONSTRAINT "training_certificates_quiz_attempt_id_fkey"
    FOREIGN KEY ("quiz_attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

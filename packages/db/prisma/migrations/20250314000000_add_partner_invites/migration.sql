-- CreateTable
CREATE TABLE "partner_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_token_key" ON "partner_invites"("token");

-- CreateIndex
CREATE INDEX "partner_invites_organization_id_idx" ON "partner_invites"("organization_id");

-- CreateIndex
CREATE INDEX "partner_invites_email_idx" ON "partner_invites"("email");

-- CreateIndex
CREATE INDEX "partner_invites_token_idx" ON "partner_invites"("token");

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

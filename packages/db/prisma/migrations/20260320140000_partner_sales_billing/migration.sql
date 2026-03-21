-- Partner sales: billing entities, sales orders, invoices, payments

CREATE TYPE "SaleOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DUE', 'CANCELLED');

CREATE TABLE "billing_entities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_entities_organization_id_slug_key" ON "billing_entities"("organization_id", "slug");
CREATE INDEX "billing_entities_organization_id_idx" ON "billing_entities"("organization_id");

ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "quote_id" TEXT,
    "sale_number" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "SaleOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "exw_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission_amount_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fob_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freight_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cif_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes_fees_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "landed_ddp_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoiced_basis" TEXT,
    "tax_breakdown_json" JSONB,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_organization_id_sale_number_key" ON "sales"("organization_id", "sale_number");
CREATE INDEX "sales_organization_id_idx" ON "sales"("organization_id");
CREATE INDEX "sales_client_id_idx" ON "sales"("client_id");
CREATE INDEX "sales_project_id_idx" ON "sales"("project_id");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sale_invoices" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "billing_entity_id" TEXT NOT NULL,
    "amount_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "reference_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_invoices_sale_id_idx" ON "sale_invoices"("sale_id");
CREATE INDEX "sale_invoices_billing_entity_id_idx" ON "sale_invoices"("billing_entity_id");
CREATE INDEX "sale_invoices_due_date_idx" ON "sale_invoices"("due_date");

ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_billing_entity_id_fkey" FOREIGN KEY ("billing_entity_id") REFERENCES "billing_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "billing_entity_id" TEXT NOT NULL,
    "amount_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_local" DOUBLE PRECISION,
    "currency_local" TEXT,
    "exchange_rate" DOUBLE PRECISION,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_organization_id_idx" ON "payments"("organization_id");
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");
CREATE INDEX "payments_billing_entity_id_idx" ON "payments"("billing_entity_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_billing_entity_id_fkey" FOREIGN KEY ("billing_entity_id") REFERENCES "billing_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

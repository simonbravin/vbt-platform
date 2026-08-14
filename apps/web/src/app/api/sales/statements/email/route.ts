import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId, requireSession, TenantError } from "@/lib/tenant";
import { withSaaSHandler } from "@/lib/saas-handler";
import { ApiHttpError } from "@/lib/api-error";
import { buildStatementsResponse } from "@/lib/partner-sales";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatementPdfDocument, type StatementPdfData } from "@/components/pdf/statement-pdf";
import { loadPdfLogoDataUrl } from "@/components/pdf/load-pdf-logo";
import { Resend } from "resend";
import { emailSubjectStatements, getResendFrom, parseEmailLocale } from "@/lib/email-config";
import { buildStatementsEmailHtml } from "@/lib/email-bodies";
import { z } from "zod";

const bodySchema = z.object({
  to: z.string().email(),
  message: z.string().max(5000).optional(),
  clientId: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  locale: z.enum(["en", "es"]).optional(),
  /** Required when sending as platform superadmin. */
  organizationId: z.string().optional(),
});

async function statementsEmailPostHandler(req: Request) {
  const user = (await requireSession()) as SessionUser;

  const role = (user.role ?? "").toLowerCase();
  if (!user.isPlatformSuperadmin && role !== "org_admin" && role !== "sales_user") {
    throw new TenantError("Forbidden", "FORBIDDEN");
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiHttpError(503, "SALES_EMAIL_NOT_CONFIGURED", "Email not configured.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiHttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Validation failed", parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || undefined,
      message: issue.message,
    })));
  }
  const data = parsed.data;

  let organizationId: string;
  if (user.isPlatformSuperadmin) {
    const fromBody = data.organizationId?.trim();
    if (!fromBody) {
      throw new ApiHttpError(400, "SALES_ORG_SCOPE_REQUIRED", "organizationId is required when sending as platform superadmin.");
    }
    organizationId = fromBody;
  } else {
    const org = getEffectiveOrganizationId(user);
    if (!org) throw new ApiHttpError(403, "SALES_ORG_SCOPE_REQUIRED", "No organization context.");
    organizationId = org;
  }

  const payload = await buildStatementsResponse(organizationId, {
    clientId: data.clientId,
    entityId: data.entityId,
    from: data.dateFrom,
    to: data.dateTo,
  });

  const pdfData: StatementPdfData = {
    generatedAt: new Date().toISOString(),
    filterFrom: data.dateFrom ?? null,
    filterTo: data.dateTo ?? null,
    filterClientName: null,
    filterEntityName: null,
    logoDataUrl: loadPdfLogoDataUrl(),
    statements: payload.statements.map((st) => ({
      client: st.client,
      sales: st.sales.map((s: { saleNumber?: string | null; id: string; project: { name: string }; statementInvoiced: number; statementPaid: number }) => ({
        saleNumber: s.saleNumber ?? s.id.slice(0, 8),
        projectName: s.project.name,
        invoiced: s.statementInvoiced,
        paid: s.statementPaid,
        balance: s.statementInvoiced - s.statementPaid,
      })),
      totalInvoiced: st.totalInvoiced,
      totalPaid: st.totalPaid,
      balance: st.balance,
    })),
  };

  const buf = await renderToBuffer(
    React.createElement(StatementPdfDocument, { data: pdfData }) as Parameters<typeof renderToBuffer>[0]
  );
  const resend = new Resend(apiKey);
  const from = getResendFrom();
  const senderPrefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailLocale: true },
  });
  const locale = parseEmailLocale(data.locale ?? senderPrefs?.emailLocale);

  const { error } = await resend.emails.send({
    from,
    to: data.to,
    subject: emailSubjectStatements(locale),
    html: buildStatementsEmailHtml(locale, {
      customMessage: data.message,
    }),
    attachments: [{ filename: "statements.pdf", content: Buffer.from(buf) }],
  });

  if (error) {
    console.error("[statements/email]", error);
    throw new ApiHttpError(502, "SALES_EMAIL_SEND_FAILED", error.message ?? "Send failed");
  }

  return NextResponse.json({ ok: true, message: `Sent to ${data.to}` });
}

export const POST = withSaaSHandler({ module: "sales", rateLimitTier: "create_update" }, statementsEmailPostHandler);

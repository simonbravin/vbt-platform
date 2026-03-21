import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { buildStatementsResponse } from "@/lib/partner-sales";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatementPdfDocument, type StatementPdfData } from "@/components/pdf/statement-pdf";
import { Resend } from "resend";
import { getResendFrom } from "@/lib/email-config";
import { z } from "zod";

const bodySchema = z.object({
  to: z.string().email(),
  message: z.string().max(5000).optional(),
  clientId: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  /** Required when sending as platform superadmin. */
  organizationId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  const role = (user.role ?? "").toLowerCase();
  if (!user.isPlatformSuperadmin && role !== "org_admin" && role !== "sales_user") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  let organizationId: string;
  if (user.isPlatformSuperadmin) {
    const fromBody = data.organizationId?.trim();
    if (!fromBody) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }
    organizationId = fromBody;
  } else {
    const org = getEffectiveOrganizationId(user);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 403 });
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

  const { error } = await resend.emails.send({
    from,
    to: data.to,
    subject: "Account statements — VBT Platform",
    html: data.message
      ? `<p>${escapeHtml(data.message)}</p><p>See attached PDF.</p>`
      : "<p>Please find your account statements attached (PDF).</p>",
    attachments: [{ filename: "statements.pdf", content: Buffer.from(buf) }],
  });

  if (error) {
    console.error("[statements/email]", error);
    return NextResponse.json({ error: error.message ?? "Send failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: `Sent to ${data.to}` });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

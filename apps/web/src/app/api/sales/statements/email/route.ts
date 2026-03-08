import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInvoicedAmount } from "@/lib/sales";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatementPdfDocument, type StatementPdfData } from "@/components/pdf/statement-pdf";
import { Resend } from "resend";
import { z } from "zod";
import { buildVbtEmailHtml, escapeHtml } from "@/lib/email-templates";

/** to = email; date range sent as dateFrom / dateTo to avoid conflict */
const schema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().optional(),
  message: z.string().optional(),
  clientId: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { to, subject, message, clientId, entityId, dateFrom, dateTo } = parsed.data;

  const where: Record<string, unknown> = { orgId: user.orgId };
  if (clientId) (where as any).clientId = clientId;
  if (dateFrom || dateTo) {
    (where as any).createdAt = {};
    if (dateFrom) (where as any).createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      (where as any).createdAt.lte = d;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { name: true } },
      invoices: { include: { entity: { select: { name: true } } } },
      payments: { include: { entity: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  let filtered = sales;
  if (entityId) {
    filtered = sales.filter(
      (s) =>
        s.invoices.some((i) => i.entityId === entityId) ||
        s.payments.some((p) => p.entityId === entityId)
    );
  }

  const byClient: Record<string, { client: { id: string; name: string }; sales: typeof filtered; totalInvoiced: number; totalPaid: number; balance: number }> = {};
  for (const sale of filtered) {
    const cid = sale.clientId;
    if (!byClient[cid]) {
      byClient[cid] = { client: sale.client, sales: [], totalInvoiced: 0, totalPaid: 0, balance: 0 };
    }
    const invTotal = getInvoicedAmount(sale);
    const payTotal = entityId
      ? sale.payments.filter((p: { entityId: string }) => p.entityId === entityId).reduce((a: number, p: { amountUsd: number }) => a + p.amountUsd, 0)
      : sale.payments.reduce((a: number, p: { amountUsd: number }) => a + p.amountUsd, 0);
    byClient[cid].sales.push(sale);
    byClient[cid].totalInvoiced += invTotal;
    byClient[cid].totalPaid += payTotal;
    byClient[cid].balance += invTotal - payTotal;
  }

  let filterClientName: string | null = null;
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, orgId: user.orgId }, select: { name: true } });
    filterClientName = client?.name ?? null;
  }
  let filterEntityName: string | null = null;
  if (entityId) {
    const entity = await prisma.billingEntity.findFirst({ where: { id: entityId, orgId: user.orgId }, select: { name: true } });
    filterEntityName = entity?.name ?? null;
  }

  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const pdfData: StatementPdfData = {
    generatedAt,
    filterFrom: dateFrom || null,
    filterTo: dateTo || null,
    filterClientName,
    filterEntityName,
    statements: Object.values(byClient).map((st) => ({
      client: st.client,
      sales: st.sales.map((s) => {
        const inv = getInvoicedAmount(s);
        const pay = entityId
          ? s.payments.filter((p: { entityId: string }) => p.entityId === entityId).reduce((a: number, p: { amountUsd: number }) => a + p.amountUsd, 0)
          : s.payments.reduce((a: number, p: { amountUsd: number }) => a + p.amountUsd, 0);
        return {
          saleNumber: s.saleNumber ?? s.id.slice(0, 8),
          projectName: s.project.name,
          invoiced: inv,
          paid: pay,
          balance: inv - pay,
        };
      }),
      totalInvoiced: st.totalInvoiced,
      totalPaid: st.totalPaid,
      balance: st.balance,
    })),
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(React.createElement(StatementPdfDocument, { data: pdfData }) as any);
  } catch (err) {
    console.error("Statement PDF generation failed:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured. Set RESEND_API_KEY." }, { status: 503 });
  }

  if (Object.keys(byClient).length === 0) {
    return NextResponse.json(
      { error: "No statements for the selected filters. Apply different filters or add sales first." },
      { status: 400 }
    );
  }

  const filterParts: string[] = [];
  if (dateFrom) filterParts.push(`From ${dateFrom}`);
  if (dateTo) filterParts.push(`to ${dateTo}`);
  if (filterClientName) filterParts.push(`Client: ${escapeHtml(filterClientName)}`);
  if (filterEntityName) filterParts.push(`Entity: ${escapeHtml(filterEntityName)}`);
  const filterLine = filterParts.length > 0 ? filterParts.join(" · ") : "All clients";

  const summaryHtml = [
    "<p style='margin: 0 0 12px 0; color: #333;'>Account statements are attached as a PDF.</p>",
    `<p style='margin: 0 0 8px 0; color: #555; font-size: 13px;'><strong>Filters:</strong> ${filterLine}</p>`,
    `<p style='margin: 0 0 8px 0; color: #555; font-size: 13px;'><strong>Generated:</strong> ${generatedAt}</p>`,
    `<p style='margin: 0; color: #555; font-size: 13px;'><strong>Clients in report:</strong> ${Object.keys(byClient).length}</p>`,
  ].join("");
  const bodyHtml = message
    ? `<div style="margin-bottom: 16px; padding: 16px; background: white; border-radius: 4px; border-left: 3px solid #1a3a5c;"><p style="margin: 0; color: #444;">${escapeHtml(message).replace(/\n/g, "<br>")}</p></div>${summaryHtml}`
    : summaryHtml;

  const html = buildVbtEmailHtml({
    title: "Account Statements",
    subtitle: "Vision Building Technologies",
    bodyHtml,
    attachmentDescription: "Please find the account statements PDF attached to this email.",
  });

  const emailSubject = subject ?? `VBT Account Statements – ${new Date().toISOString().slice(0, 10)}`;
  const filename = `account-statements-${new Date().toISOString().slice(0, 10)}.pdf`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "quotes@visionbuildingtechs.com",
      to,
      subject: emailSubject,
      html,
      attachments: [{ filename, content: pdfBuffer }],
    });
    return NextResponse.json({ ok: true, message: `Statements sent to ${to}` });
  } catch (err) {
    console.error("Statements email send failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}

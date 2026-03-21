import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listDueInvoiceItems } from "@/lib/partner-sales";
import { Resend } from "resend";
import { getResendFrom } from "@/lib/email-config";

/**
 * Vercel Cron or manual: GET with Authorization: Bearer CRON_SECRET
 * Sends one digest email per org to active org_admin addresses when there are invoices due in the next 7 days.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const vercelCron = process.env.VERCEL === "1" && req.headers.get("x-vercel-cron") === "1";
  const bearerOk = !!secret && auth === `Bearer ${secret}`;
  if (!vercelCron && !bearerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const orgs = await prisma.organization.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
  });

  const resend = new Resend(apiKey);
  const from = getResendFrom();
  let emailsSent = 0;

  for (const org of orgs) {
    const { count, invoices } = await listDueInvoiceItems(org.id, 7);
    if (count === 0) continue;

    const admins = await prisma.orgMember.findMany({
      where: { organizationId: org.id, status: "active", role: "org_admin" },
      include: { user: { select: { email: true, isActive: true } } },
    });
    const toList = admins.map((m) => m.user.email).filter(Boolean) as string[];
    if (toList.length === 0) continue;

    const rows = invoices
      .map(
        (inv) =>
          `<tr><td>${escapeHtml(inv.clientName)}</td><td>${escapeHtml(inv.saleId.slice(0, 8))}</td><td>${inv.amountUsd.toFixed(2)}</td><td>${escapeHtml(inv.dueDate.slice(0, 10))}</td></tr>`
      )
      .join("");

    const html = `<p>Upcoming or due invoice installments (${count}) for <strong>${escapeHtml(org.name)}</strong>:</p>
<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Client</th><th>Sale</th><th>Amount USD</th><th>Due</th></tr></thead><tbody>${rows}</tbody></table>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sales/statements">Open statements</a></p>`;

    const { error } = await resend.emails.send({
      from,
      to: toList[0],
      bcc: toList.length > 1 ? toList.slice(1) : undefined,
      subject: `[VBT Platform] ${count} payment(s) due soon — ${org.name}`,
      html,
    });
    if (!error) emailsSent += 1;
    else console.error("[cron/sales-due-reminders]", org.id, error);
  }

  return NextResponse.json({ ok: true, orgsChecked: orgs.length, emailsSent });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

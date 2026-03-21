import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Resend } from "resend";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { createActivityLog } from "@/lib/audit";
import { canManageQuotes } from "@/lib/permissions";
import { quoteByIdWhere } from "@/lib/quote-scope";
import type { SessionUser } from "@/lib/auth";
import { buildQuoteSentEmailHtml } from "@/lib/email-bodies";
import { getResendFrom, emailSubjectQuote, parseEmailLocale } from "@/lib/email-config";

const sendSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().optional(),
  message: z.string().optional(),
  locale: z.enum(["en", "es"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!canManageQuotes(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const scoped = quoteByIdWhere(user, params.id);
  if (!scoped.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quote = await prisma.quote.findFirst({
    where: scoped.where,
    include: { project: { include: { client: { select: { name: true } } } }, preparedByUser: { select: { fullName: true } } },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  const quotedByName = (quote as { preparedByUser?: { fullName?: string } }).preparedByUser?.fullName ?? "VBT Team";

  // Generate PDF by calling our own PDF endpoint
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let pdfBuffer: Buffer | null = null;

  try {
    const pdfRes = await fetch(`${appUrl}/api/quotes/${params.id}/pdf`, {
      headers: {
        Cookie: req.headers.get("Cookie") ?? "",
      },
    });

    if (pdfRes.ok) {
      const arrayBuffer = await pdfRes.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    }
  } catch (pdfErr) {
    console.warn("PDF generation failed, sending without attachment:", pdfErr);
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured. Set RESEND_API_KEY." },
      { status: 503 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const quoteNumber = (quote as { quoteNumber?: string }).quoteNumber ?? quote.id.slice(0, 8).toUpperCase();
  const projectName = (quote.project as { projectName?: string; name?: string }).projectName ?? (quote.project as { name?: string }).name ?? "";
  const clientName = (quote.project as { client?: { name: string } }).client?.name ?? "";
  const totalPrice = (quote as { totalPrice?: number }).totalPrice ?? 0;

  const senderId = (user as { id?: string; userId?: string }).id ?? (user as { userId?: string }).userId;
  const senderPrefs = senderId
    ? await prisma.user.findUnique({
        where: { id: senderId },
        select: { emailLocale: true },
      })
    : null;
  const quoteMailLocale = parseEmailLocale(parsed.data.locale ?? senderPrefs?.emailLocale);

  const subject =
    parsed.data.subject ?? emailSubjectQuote(quoteMailLocale, quoteNumber, projectName);

  const htmlBody = buildQuoteSentEmailHtml(quoteMailLocale, {
    quoteNumber,
    quotedByName,
    projectName,
    clientName,
    totalPrice,
    optionalMessage: parsed.data.message,
    hasPdfAttachment: Boolean(pdfBuffer),
  });

  try {
    const emailResult = await resend.emails.send({
      from: getResendFrom(),
      to: parsed.data.to,
      subject,
      html: htmlBody,
      attachments: pdfBuffer
        ? [
            {
              filename: `VBT-Quote-${quoteNumber}.pdf`,
              content: pdfBuffer,
            },
          ]
        : undefined,
    });

    await prisma.quote.update({
      where: { id: params.id },
      data: { status: "sent" },
    });

    if (quote.project?.id) {
      const proj = await prisma.project.findUnique({
        where: { id: quote.project.id },
        select: { status: true },
      });
      const s = proj?.status as string | undefined;
      if (s === "lead" || s === "qualified") {
        await prisma.project.update({
          where: { id: quote.project.id },
          data: { status: "quoting" },
        });
      }
    }

    await createActivityLog({
      organizationId: getEffectiveOrganizationId(user) ?? undefined,
      userId: user.id,
      action: "quote_sent",
      entityType: "quote",
      entityId: params.id,
      metadata: { to: parsed.data.to, quoteNumber },
    });

    return NextResponse.json({
      success: true,
      messageId: emailResult.data?.id,
    });
  } catch (emailErr: any) {
    console.error("Email send error:", emailErr);
    return NextResponse.json(
      { error: emailErr.message ?? "Failed to send email" },
      { status: 500 }
    );
  }
}

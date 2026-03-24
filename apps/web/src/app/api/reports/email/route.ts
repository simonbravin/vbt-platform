import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { buildProjectsReportEmailHtml } from "@/lib/email-bodies";
import { getResendFrom, emailSubjectReport, parseEmailLocale } from "@/lib/email-config";
import { Resend } from "resend";
import type { SessionUser } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  to: z.string().email(),
  subject: z.string().max(200).optional(),
  status: z.string().optional(),
  countryId: z.string().optional(),
  countryCode: z.string().optional(),
  clientId: z.string().optional(),
  soldFrom: z.string().optional(),
  soldTo: z.string().optional(),
  search: z.string().optional(),
  locale: z.enum(["en", "es"]).optional(),
});

const STATUS_MAP: Record<string, string> = {
  DRAFT: "lead",
  QUOTED: "quoting",
  QUOTE_SENT: "quoting",
  SOLD: "won",
  ARCHIVED: "lost",
  lead: "lead",
  qualified: "qualified",
  quoting: "quoting",
  engineering: "engineering",
  won: "won",
  lost: "lost",
  on_hold: "on_hold",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser & { activeOrgId?: string | null; id?: string };
  const organizationId = await getEffectiveActiveOrgId(user);
  if (!organizationId) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 });
  }

  // Only org_admin and platform superadmin may send report by email
  if (!user.isPlatformSuperadmin) {
    const member = await prisma.orgMember.findFirst({
      where: { organizationId, userId: (user as { id: string }).id },
      select: { role: true },
    });
    if (!member || member.role !== "org_admin") {
      return NextResponse.json({ error: "Forbidden: only org admins can send report by email" }, { status: 403 });
    }
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body. Required: to (email). Optional: subject, status, countryId, countryCode, clientId, soldFrom, soldTo, search." }, { status: 400 });
  }

  const where: Record<string, unknown> = { organizationId };
  const countryCode = body.countryCode ?? body.countryId ?? "";
  if (body.status) {
    where.status = STATUS_MAP[body.status] ?? body.status;
  }
  if (countryCode) where.countryCode = countryCode;
  if (body.clientId) where.clientId = body.clientId;
  if (body.search?.trim()) {
    where.OR = [
      { projectName: { contains: body.search.trim(), mode: "insensitive" } },
      { client: { name: { contains: body.search.trim(), mode: "insensitive" } } },
      { city: { contains: body.search.trim(), mode: "insensitive" } },
      { address: { contains: body.search.trim(), mode: "insensitive" } },
    ];
  }
  if (body.soldFrom || body.soldTo) {
    (where as Record<string, unknown>).status = "won";
    (where as Record<string, unknown>).quotes = {
      some: {
        status: "accepted",
        updatedAt: {
          ...(body.soldFrom ? { gte: new Date(body.soldFrom) } : {}),
          ...(body.soldTo ? { lte: new Date(body.soldTo + "T23:59:59.999Z") } : {}),
        },
      },
    };
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      quotes: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        where: { status: "accepted" },
        select: { id: true, quoteNumber: true, totalPrice: true, status: true, updatedAt: true },
      },
      _count: { select: { quotes: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const acceptedQuoteByProject = await prisma.quote.findMany({
    where: { organizationId, projectId: { in: projects.map((p) => p.id) }, status: "accepted" },
    select: { projectId: true, totalPrice: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const valueSoldByProject = new Map(acceptedQuoteByProject.map((q) => [q.projectId, { totalPrice: q.totalPrice ?? 0, updatedAt: q.updatedAt }]));

  const rows = projects.map((p) => {
    const accepted = p.quotes[0] ?? valueSoldByProject.get(p.id);
    return {
      projectName: p.projectName,
      client: p.client?.name ?? null,
      location: p.city ?? p.address ?? null,
      countryCode: p.countryCode ?? null,
      status: p.status,
      quoteNumber: (p.quotes[0] as { quoteNumber?: string } | undefined)?.quoteNumber ?? null,
      fobUsd: (p.quotes[0] as { totalPrice?: number } | undefined)?.totalPrice ?? (accepted as { totalPrice?: number } | undefined)?.totalPrice ?? null,
      soldAt: (accepted as { updatedAt?: Date } | undefined)?.updatedAt ?? null,
      finalAmountUsd: p.status === "won" && accepted ? ((accepted as { totalPrice?: number }).totalPrice ?? null) : null,
      quotesCount: p._count.quotes,
    };
  });

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = ["Project", "Client", "Location", "Country", "Status", "Quote number", "FOB (USD)", "Sale date", "Final amount", "Quotes count"];
  const csvRows = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.projectName,
        r.client ?? "",
        r.location ?? "",
        r.countryCode ?? "",
        r.status,
        r.quoteNumber ?? "",
        r.fobUsd ?? "",
        r.soldAt ? new Date(r.soldAt).toLocaleDateString() : "",
        r.finalAmountUsd ?? "",
        r.quotesCount,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const csv = csvRows.join("\n");
  const filename = `vbt-projects-report-${new Date().toISOString().slice(0, 10)}.csv`;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)" }, { status: 503 });
  }

  const senderPrefs = await prisma.user.findUnique({
    where: { id: (user as { id: string }).id },
    select: { emailLocale: true, fullName: true },
  });
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const reportMailLocale = parseEmailLocale(body.locale ?? senderPrefs?.emailLocale);
  const subject = body.subject?.trim() || emailSubjectReport(reportMailLocale);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.visionlatam.com").replace(/\/$/, "");
  const htmlBody = buildProjectsReportEmailHtml(reportMailLocale, {
    rowCount: rows.length,
    organizationName: org?.name ?? "Vision Building Technologies",
    generatedByName: senderPrefs?.fullName ?? undefined,
    reportsUrl: `${baseUrl}/reports`,
    filterParts: {
      status: body.status ?? null,
      countryCode,
      hasClientFilter: Boolean(body.clientId),
      hasSearch: Boolean(body.search?.trim()),
      hasSoldRange: Boolean(body.soldFrom || body.soldTo),
    },
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: getResendFrom(),
      to: body.to,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: Buffer.from(csv, "utf-8"),
        },
      ],
    });
    return NextResponse.json({ message: `Report sent to ${body.to}` });
  } catch (err) {
    console.error("Reports email send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}

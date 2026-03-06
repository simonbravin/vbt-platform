import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { z } from "zod";

const STATUS_VALUES = ["DRAFT", "QUOTED", "QUOTE_SENT", "SOLD", "ARCHIVED"] as const;
const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  QUOTED: "Quoted",
  QUOTE_SENT: "Quote sent",
  SOLD: "Sold",
  ARCHIVED: "Archived",
};

const bodySchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().optional(),
  status: z.string().optional(),
  countryId: z.string().optional(),
  clientId: z.string().optional(),
  soldFrom: z.string().optional(),
  soldTo: z.string().optional(),
  search: z.string().optional(),
});

function escapeCsv(v: unknown): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { to, subject, status, countryId, clientId, soldFrom, soldTo, search } = parsed.data;

  const where: Record<string, unknown> = { orgId: user.orgId };
  if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
    where.status = status;
  }
  if (countryId) where.countryId = countryId;
  if (clientId) where.clientId = clientId;
  if (soldFrom || soldTo) {
    where.soldAt = {};
    if (soldFrom) (where.soldAt as Record<string, Date>).gte = new Date(soldFrom);
    if (soldTo) {
      const d = new Date(soldTo);
      d.setHours(23, 59, 59, 999);
      (where.soldAt as Record<string, Date>).lte = d;
    }
  }
  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" as const } },
      { client: { contains: search.trim(), mode: "insensitive" as const } },
      { clientRecord: { name: { contains: search.trim(), mode: "insensitive" as const } } },
      { location: { contains: search.trim(), mode: "insensitive" as const } },
      { country: { name: { contains: search.trim(), mode: "insensitive" as const } } },
      { country: { code: { contains: search.trim(), mode: "insensitive" as const } } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      clientRecord: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      baselineQuote: { select: { id: true, quoteNumber: true, fobUsd: true } },
      _count: { select: { quotes: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10000,
  });

  const headers = [
    "Project",
    "Client",
    "Location",
    "Country",
    "Status",
    "Baseline quote",
    "Project FOB",
    "Sale date",
    "Final amount",
    "Quotes count",
  ];
  const csvRows = [
    headers.join(","),
    ...projects.map((p) =>
      [
        p.name,
        (p.clientRecord?.name ?? p.client) ?? "",
        p.location ?? "",
        p.country?.name ?? "",
        statusLabel[p.status] ?? p.status,
        p.baselineQuote?.quoteNumber ?? "",
        p.baselineQuote?.fobUsd ?? "",
        p.soldAt ? new Date(p.soldAt).toLocaleDateString() : "",
        p.finalAmountUsd ?? "",
        p._count.quotes,
      ].map(escapeCsv).join(",")
    ),
  ];
  const csv = csvRows.join("\n");
  const filename = `vbt-projects-report-${new Date().toISOString().slice(0, 10)}.csv`;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured. Set RESEND_API_KEY." },
      { status: 503 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const emailSubject = subject ?? `VBT Projects Report – ${new Date().toISOString().slice(0, 10)}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "quotes@visionbuildingtechs.com",
      to,
      subject: emailSubject,
      html: `<p>Please find the VBT projects report attached (${projects.length} project(s)).</p>`,
      attachments: [
        {
          filename,
          content: Buffer.from(csv, "utf-8"),
        },
      ],
    });
    return NextResponse.json({ ok: true, message: `Report sent to ${to}` });
  } catch (err) {
    console.error("Reports email send failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}

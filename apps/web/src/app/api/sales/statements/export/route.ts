import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { requireSalesScopedOrganizationId } from "@/lib/sales-access";
import { buildStatementsResponse } from "@/lib/partner-sales";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatementPdfDocument, type StatementPdfData } from "@/components/pdf/statement-pdf";

function escapeCsvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const url = new URL(req.url);

  let organizationId: string;
  if (!user.isPlatformSuperadmin) {
    const org = getEffectiveOrganizationId(user);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 403 });
    organizationId = org;
  } else {
    const scoped = await requireSalesScopedOrganizationId(user, url);
    if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
    organizationId = scoped.organizationId;
  }

  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  const payload = await buildStatementsResponse(organizationId, { clientId, entityId, from, to });

  if (format === "pdf") {
    const pdfData: StatementPdfData = {
      generatedAt: new Date().toISOString(),
      filterFrom: from ?? null,
      filterTo: to ?? null,
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
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statements-${organizationId.slice(0, 8)}.pdf"`,
      },
    });
  }

  const lines = ["client,sale_number,project,invoiced,paid,balance"];
  for (const st of payload.statements) {
    for (const s of st.sales as Array<{
      saleNumber?: string | null;
      id: string;
      project: { name: string };
      statementInvoiced: number;
      statementPaid: number;
    }>) {
      const sn = s.saleNumber ?? s.id.slice(0, 8);
      const inv = s.statementInvoiced;
      const paid = s.statementPaid;
      const bal = inv - paid;
      lines.push(
        [
          escapeCsvCell(st.client.name),
          escapeCsvCell(sn),
          escapeCsvCell(s.project.name),
          inv.toFixed(2),
          paid.toFixed(2),
          bal.toFixed(2),
        ].join(",")
      );
    }
  }
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="statements-${organizationId.slice(0, 8)}.csv"`,
    },
  });
}

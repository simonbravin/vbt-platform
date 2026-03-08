import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInvoicedAmount } from "@/lib/sales";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatementPdfDocument, type StatementPdfData } from "@/components/pdf/statement-pdf";

function escapeCsv(s: string | number | null | undefined): string {
  if (s == null) return "";
  const str = String(s);
  if (/[,"\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  const entityId = url.searchParams.get("entityId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const format = url.searchParams.get("format") ?? "csv";

  const where: Record<string, unknown> = { orgId: user.orgId };
  if (clientId) (where as any).clientId = clientId;
  if (from || to) {
    (where as any).createdAt = {};
    if (from) (where as any).createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
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

  if (format === "pdf") {
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

    const pdfData: StatementPdfData = {
      generatedAt: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
      filterFrom: from || null,
      filterTo: to || null,
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

    const buffer = await renderToBuffer(React.createElement(StatementPdfDocument, { data: pdfData }) as any);
    const filename = `account-statements-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "csv") {
    const rows: string[][] = [
      ["Client", "Project", "Sale #", "Date", "Sales condition", "Invoiced", "Paid", "Balance"],
    ];
    for (const sale of filtered) {
      const invTotal = getInvoicedAmount(sale);
      const payTotal = entityId
        ? sale.payments.filter((p: { entityId: string }) => p.entityId === entityId).reduce((a: number, p: { amountUsd: number }) => a + p.amountUsd, 0)
        : sale.payments.reduce((a: number, p: { amountUsd: number }) => a + p.amountUsd, 0);
      const dateStr = sale.createdAt.toISOString().slice(0, 10);
      const basis = (sale.invoicedBasis || "DDP").toUpperCase();
      rows.push([
        sale.client.name,
        sale.project.name,
        sale.saleNumber ?? "",
        dateStr,
        basis,
        String(invTotal),
        String(payTotal),
        String(invTotal - payTotal),
      ]);
    }
    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    const filename = `sales-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { salesListWhere } from "@/lib/sales-access";
import { SaleOrderStatus } from "@vbt/db";
import type { Prisma } from "@vbt/db";
import { getInvoicedAmount } from "@/lib/sales";

function esc(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function parseStatus(s: string | null): SaleOrderStatus | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase();
  const map: Record<string, SaleOrderStatus> = {
    DRAFT: SaleOrderStatus.DRAFT,
    CONFIRMED: SaleOrderStatus.CONFIRMED,
    PARTIALLY_PAID: SaleOrderStatus.PARTIALLY_PAID,
    PAID: SaleOrderStatus.PAID,
    DUE: SaleOrderStatus.DUE,
    CANCELLED: SaleOrderStatus.CANCELLED,
  };
  return map[up];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;

  const url = new URL(req.url);
  const baseWhere = await salesListWhere(user, url);
  const status = parseStatus(url.searchParams.get("status"));
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = new Date(from + "T00:00:00.000Z");
  if (to) createdAt.lte = new Date(to + "T23:59:59.999Z");

  const where: Prisma.SaleWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(from || to ? { createdAt } : {}),
  };

  const sales = await prisma.sale.findMany({
    where,
    include: {
      client: { select: { name: true } },
      project: { select: { projectName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = "sale_number,status,client,project,qty,basis_amount_usd,created_at";
  const lines = [header];
  for (const s of sales) {
    const basis = getInvoicedAmount(s);
    lines.push(
      [
        esc(s.saleNumber ?? s.id.slice(0, 8)),
        s.status,
        esc(s.client.name),
        esc(s.project.projectName),
        String(s.quantity),
        basis.toFixed(2),
        s.createdAt.toISOString(),
      ].join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-export.csv"`,
    },
  });
}

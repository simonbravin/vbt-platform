import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInvoicedAmount } from "@/lib/sales";

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
  const status = url.searchParams.get("status") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const projectId = url.searchParams.get("projectId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5000"), 10000);

  const where: Record<string, unknown> = { orgId: user.orgId };
  if (status) (where as any).status = status;
  if (clientId) (where as any).clientId = clientId;
  if (projectId) (where as any).projectId = projectId;
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
      client: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const rows: string[][] = [
    ["Sale #", "Client", "Project", "Date", "Sales condition", "Price", "Status"],
  ];
  for (const s of sales) {
    const basis = (s.invoicedBasis || "DDP").toUpperCase();
    const price = getInvoicedAmount(s);
    rows.push([
      s.saleNumber ?? "",
      s.client.name,
      s.project.name,
      s.createdAt.toISOString().slice(0, 10),
      basis,
      String(price),
      s.status,
    ]);
  }
  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  const filename = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { getPartnerLeaderboard } from "@vbt/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requirePlatformSuperadmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ctx = await getTenantContext();
  if (!ctx?.isPlatformSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const type = (url.searchParams.get("type") ?? "leaderboard").toLowerCase();
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const sort = url.searchParams.get("sort") ?? "revenue";

  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "Invalid format. Use csv or xlsx." }, { status: 400 });
  }

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: true,
  };

  if (type === "leaderboard") {
    const result = await getPartnerLeaderboard(prisma, tenantCtx, {
      sort: sort === "quotes_accepted" ? "quotes_accepted" : "revenue",
      limit: 500,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    type Row = { partnerName: string; projects: number; quotes: number; quotes_accepted: number; revenue: number; conversionRate: number };
    const list: Row[] = Array.isArray(result) ? (result as Row[]) : (result as { leaderboard?: Row[] }).leaderboard ?? [];
    const rows = list.map((r) => [
      r.partnerName,
      r.projects,
      r.quotes,
      r.quotes_accepted,
      r.revenue,
      r.conversionRate,
    ]);
    const headers = ["Partner", "Projects", "Quotes", "Quotes accepted", "Revenue", "Conversion %"];
    const aoa = [headers, ...rows];

    if (format === "xlsx") {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "Leaderboard");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `vbt-analytics-leaderboard-${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const filename = `vbt-analytics-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid type. Use leaderboard." }, { status: 400 });
}

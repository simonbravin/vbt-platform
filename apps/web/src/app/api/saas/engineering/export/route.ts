import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { listEngineeringRequests } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";
import { rowsToCsv } from "@/lib/csv-export";

const ENGINEERING_STATUSES = ["draft", "in_review", "completed"] as const;

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx?.isPlatformSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const searchRaw = url.searchParams.get("search")?.trim();
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: true,
  };
  const pageSize = 500;
  const collected: Awaited<ReturnType<typeof listEngineeringRequests>>["requests"] = [];
  let offset = 0;
  let total = 0;
  do {
    const result = await listEngineeringRequests(prisma, tenantCtx, {
      projectId: url.searchParams.get("projectId") ?? undefined,
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      assignedToUserId: url.searchParams.get("assignedToUserId") ?? undefined,
      status:
        statusParam && ENGINEERING_STATUSES.includes(statusParam as (typeof ENGINEERING_STATUSES)[number])
          ? (statusParam as (typeof ENGINEERING_STATUSES)[number])
          : undefined,
      search: searchRaw && searchRaw.length > 0 ? searchRaw : undefined,
      limit: pageSize,
      offset,
    });
    total = result.total;
    collected.push(...result.requests);
    if (result.requests.length === 0) break;
    offset += pageSize;
  } while (offset < total && collected.length < 20000);

  const headers = [
    "id",
    "requestNumber",
    "status",
    "organizationId",
    "organizationName",
    "projectId",
    "projectName",
    "countryCode",
    "assignedToUserId",
    "assigneeName",
    "createdAt",
    "updatedAt",
  ];
  const rows = collected.map((r) => {
    const org = r.organization as { id?: string; name?: string } | null | undefined;
    const proj = r.project as
      | { id?: string; projectName?: string; countryCode?: string | null }
      | null
      | undefined;
    const assignee = r.assignedToUser as { id?: string; fullName?: string | null } | null | undefined;
    return [
      r.id,
      r.requestNumber,
      r.status,
      org?.id ?? "",
      org?.name ?? "",
      proj?.id ?? "",
      proj?.projectName ?? "",
      proj?.countryCode ?? "",
      assignee?.id ?? "",
      assignee?.fullName ?? "",
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      r.updatedAt instanceof Date ? r.updatedAt.toISOString() : "",
    ].map(String);
  });
  const csv = rowsToCsv(headers, rows);
  const filename = `engineering-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withSaaSHandler({}, getHandler);

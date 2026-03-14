import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requireActiveOrg } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { listQuotes, createQuote } from "@vbt/core";
import { createQuoteSchema, listQuotesQuerySchema } from "@vbt/core/validation";
import { generateQuoteNumber } from "@/lib/utils";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx?.activeOrgId && !ctx?.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  const url = new URL(req.url);
  const parsed = listQuotesQuerySchema.safeParse({
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined,
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });
  if (!parsed.success) throw parsed.error;
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const result = await listQuotes(prisma, tenantCtx, {
    projectId: url.searchParams.get("projectId") ?? undefined,
    status: parsed.data.status,
    search: parsed.data.search,
    limit: parsed.data.limit ?? 50,
    offset: parsed.data.offset ?? 0,
  });
  return NextResponse.json(result);
}

async function postHandler(req: Request) {
  const user = await requireActiveOrg();
  const body = await req.json();
  const parsed = createQuoteSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const data = parsed.data;
  const quoteNumber = data.quoteNumber ?? generateQuoteNumber();
  const tenantCtx = {
    userId: user.userId ?? user.id,
    organizationId: user.activeOrgId ?? null,
    isPlatformSuperadmin: user.isPlatformSuperadmin,
  };
  const quote = await createQuote(prisma, tenantCtx, {
    ...data,
    quoteNumber,
    items: data.items,
  });
  await createActivityLog({
    organizationId: user.activeOrgId ?? null,
    userId: user.userId ?? user.id,
    action: "quote_created",
    entityType: "quote",
    entityId: quote.id,
    metadata: { quoteNumber, projectId: data.projectId },
  });
  return NextResponse.json(quote, { status: 201 });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

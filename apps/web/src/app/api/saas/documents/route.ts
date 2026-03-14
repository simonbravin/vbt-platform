import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg } from "@/lib/tenant";
import { listDocuments, createDocument } from "@vbt/core";
import { createDocumentSchema } from "@vbt/core/validation";
import { createActivityLog } from "@/lib/audit";
import { withSaaSHandler } from "@/lib/saas-handler";

const VISIBILITY = ["public", "partners_only", "internal"] as const;

async function getHandler(req: Request) {
  const url = new URL(req.url);
  const visibilityParam = url.searchParams.get("visibility");
  const result = await listDocuments(prisma, {
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    categoryCode: url.searchParams.get("categoryCode") ?? undefined,
    visibility:
      visibilityParam && VISIBILITY.includes(visibilityParam as (typeof VISIBILITY)[number])
        ? (visibilityParam as (typeof VISIBILITY)[number])
        : undefined,
    countryScope: url.searchParams.get("countryScope") ?? undefined,
    limit: Number(url.searchParams.get("limit")) || 100,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

async function postHandler(req: Request) {
  const user = await requireActiveOrg();
  const body = await req.json();
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  const doc = await createDocument(prisma, {
    ...parsed.data,
    createdByUserId: user.userId ?? user.id,
  });
  await createActivityLog({
    organizationId: user.activeOrgId ?? null,
    userId: user.userId ?? user.id,
    action: "document_uploaded",
    entityType: "document",
    entityId: doc.id,
    metadata: { title: doc.title, categoryId: doc.categoryId },
  });
  return NextResponse.json(doc, { status: 201 });
}

export const GET = withSaaSHandler({}, getHandler);
export const POST = withSaaSHandler({}, postHandler);

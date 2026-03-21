import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveOrg, getTenantContext } from "@/lib/tenant";
import {
  getDocumentById,
  updateDocument,
  canReadDocument,
  canMutateDocument,
} from "@vbt/core";
import { updateDocumentSchema } from "@vbt/core/validation";
import { resolveDocumentViewerCountryCode } from "@/lib/document-viewer-country";

type ListedDoc = {
  allowedOrganizations?: { organizationId: string }[];
  [key: string]: unknown;
};

function formatDocument(doc: ListedDoc, forSuperadmin: boolean) {
  const { allowedOrganizations, ...rest } = doc;
  if (forSuperadmin) {
    return {
      ...rest,
      allowedOrganizationIds: allowedOrganizations?.map((a) => a.organizationId) ?? [],
    };
  }
  return rest;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const doc = await getDocumentById(prisma, params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewerCountryCode = await resolveDocumentViewerCountryCode(prisma, ctx.activeOrgId);
  if (
    !canReadDocument(
      {
        organizationId: doc.organizationId,
        visibility: doc.visibility,
        countryScope: doc.countryScope,
        allowedOrganizations: doc.allowedOrganizations,
      },
      {
        isPlatformSuperadmin: ctx.isPlatformSuperadmin,
        activeOrgId: ctx.activeOrgId ?? null,
        viewerCountryCode,
      }
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(formatDocument(doc as ListedDoc, ctx.isPlatformSuperadmin));
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireActiveOrg();
    const existing = await getDocumentById(prisma, params.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ctx = await getTenantContext();
    if (
      !ctx ||
      !canMutateDocument(existing, {
        isPlatformSuperadmin: ctx.isPlatformSuperadmin,
        activeOrgId: ctx.activeOrgId ?? null,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const doc = await updateDocument(prisma, params.id, parsed.data);
    return NextResponse.json(formatDocument(doc as ListedDoc, ctx.isPlatformSuperadmin));
  } catch (e) {
    throw e;
  }
}

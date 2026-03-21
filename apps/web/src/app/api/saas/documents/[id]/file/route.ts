import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { getDocumentById, canReadDocument } from "@vbt/core";
import { getDownloadUrl, isR2StorageKey } from "@/lib/r2-client";
import { resolveDocumentViewerCountryCode } from "@/lib/document-viewer-country";

/** GET: redirect to signed R2 URL or legacy URL. Access checked first. */
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
  const fileUrl = doc.fileUrl?.trim();
  if (!fileUrl) return NextResponse.json({ error: "No file" }, { status: 404 });

  try {
    if (isR2StorageKey(fileUrl)) {
      const signedUrl = await getDownloadUrl(fileUrl);
      return NextResponse.redirect(signedUrl);
    }
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return NextResponse.redirect(fileUrl);
    }
    return NextResponse.json(
      { error: "File not available for download" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[documents/[id]/file]", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

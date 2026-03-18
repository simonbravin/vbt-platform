import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getDownloadUrl, isR2StorageKey } from "@/lib/r2-client";

/** GET: redirect to signed R2 URL or legacy URL. Access checked (same org or superadmin). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const request = await prisma.engineeringRequest.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canAccess =
      ctx.isPlatformSuperadmin || request.organizationId === ctx.activeOrgId;
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const file = await prisma.engineeringFile.findFirst({
      where: { id: params.fileId, engineeringRequestId: params.id },
    });
    if (!file?.fileUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fileUrl = file.fileUrl.trim();
    if (isR2StorageKey(fileUrl)) {
      const signedUrl = await getDownloadUrl(fileUrl);
      return NextResponse.redirect(signedUrl);
    }
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return NextResponse.redirect(fileUrl);
    }
    return NextResponse.json({ error: "File not available" }, { status: 400 });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[engineering files file]", e);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

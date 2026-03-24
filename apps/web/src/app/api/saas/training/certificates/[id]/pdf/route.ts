import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { getCertificateById } from "@vbt/core";
import { renderTrainingCertificatePdfBuffer } from "@/lib/training-certificate-pdf";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const cert = await getCertificateById(prisma, tenantCtx, params.id, { admin: ctx.isPlatformSuperadmin });
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const issued = cert.issuedAt.toISOString().slice(0, 10);
  const meta = cert.metadataJson as { scorePct?: number } | null;
  const quizStatement =
    cert.type === "quiz" && meta?.scorePct != null
      ? `Certificate of completion for the knowledge quiz. Score: ${meta.scorePct}%.`
      : "Certificate of completion for the knowledge quiz.";

  const buf = await renderTrainingCertificatePdfBuffer({
    title: cert.titleSnapshot,
    participantName: cert.participantNameSnapshot,
    organizationName: cert.orgNameSnapshot,
    issuedAtLabel: issued,
    statement:
      cert.type === "live_session"
        ? "Certificate of participation in the live training session."
        : quizStatement,
    brandLine: "VBT Platform",
  });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${params.id.slice(0, 8)}.pdf"`,
    },
  });
}

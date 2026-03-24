import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { getCertificateById } from "@vbt/core";
import { renderTrainingCertificatePdfBuffer } from "@/lib/training-certificate-pdf";

function publicAppBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return u && u.length > 0 ? u : "https://app.visionlatam.com";
}

function loadLogoDataUrl(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "brand", "vision-logo.png"),
    path.join(process.cwd(), "apps", "web", "public", "brand", "vision-logo.png"),
  ];
  try {
    const logoPath = candidates.find((p) => fs.existsSync(p));
    if (!logoPath) return null;
    const b64 = fs.readFileSync(logoPath).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
  const scoreLabel =
    cert.type === "quiz" && meta?.scorePct != null ? `${meta.scorePct}%` : "—";

  const verifyUrl = `${publicAppBaseUrl()}/certificados/verificar/${cert.verifyPublicCode}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 160,
      color: { dark: "#0c4a6e", light: "#ffffff" },
    });
  } catch {
    qrDataUrl = null;
  }

  const buf = await renderTrainingCertificatePdfBuffer({
    participantName: cert.participantNameSnapshot,
    organizationName: cert.orgNameSnapshot,
    programTitle: cert.titleSnapshot,
    scoreLabel,
    issuedAtLabel: issued,
    statementPrimary: cert.statementPrimarySnapshot ?? "",
    statementSecondary: cert.statementSecondarySnapshot ?? null,
    verifyPublicCode: cert.verifyPublicCode,
    internalId: cert.id,
    verifyUrl,
    logoDataUrl: loadLogoDataUrl(),
    qrDataUrl,
  });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-vbt-${cert.verifyPublicCode.slice(0, 8)}.pdf"`,
    },
  });
}
